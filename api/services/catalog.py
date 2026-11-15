"""Turn the BMRCL station dump into one station per code, ordered by line."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field

from clients.bmrc import BmrcClient
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from schemas.station import Line, LineDetail, Station, StationLine

# Words the site actually sends. A new colour passes through unmapped.
COLOR_HEX = {
    "purple": "#7B2D8E",
    "green": "#1B8A3E",
    "yellow": "#F2C200",
    "pink": "#E31C79",
}

LINE_CODES = {
    1: "PL",
    2: "GL",
    3: "YL",
    4: "PK",
}


def line_code_for(line_id: int) -> str:
    return LINE_CODES.get(line_id, f"L{line_id}")


def clean_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).replace("\r", "").replace("\n", "").strip()


def color_hex(word: str) -> str | None:
    return COLOR_HEX.get(word.strip().lower())


@dataclass
class Catalog:
    stations: dict[str, Station]
    lines: list[LineDetail]
    fetched_at: float
    source: str

    def station(self, code: str) -> Station:
        found = self.stations.get(code.upper())
        if found is None:
            raise ApiRequestError(f"Unknown station code {code}.", status_code=404)
        return found

    def line(self, code: str) -> LineDetail:
        needle = code.upper()
        for line in self.lines:
            if line.code == needle:
                return line
        raise ApiRequestError(f"Unknown line code {code}.", status_code=404)


def load_interchange_aliases(path=None) -> dict[str, str]:
    """Extra codes that name a station we already have. Empty in v1."""

    target = path or settings.bmrc_interchanges_path
    if not target.exists():
        return {}
    raw = json.loads(target.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return {}
    return {str(key).upper(): str(value).upper() for key, value in raw.items()}


def normalize_rows(
    rows: list[dict],
    aliases: dict[str, str] | None = None,
) -> Catalog:
    aliases = {key.upper(): value.upper() for key, value in (aliases or {}).items()}
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        code = clean_text(row.get("vStationCode")).upper()
        if not code:
            continue
        code = aliases.get(code, code)
        grouped.setdefault(code, []).append(row)

    stations: dict[str, Station] = {}
    by_line: dict[int, list[tuple[int, str]]] = {}

    for code, group in grouped.items():
        # Prefer the row whose display name is longest when names disagree.
        named = max(group, key=lambda row: len(clean_text(row.get("vStationName"))))
        line_refs: list[StationLine] = []
        seen_lines: set[int] = set()
        for row in sorted(group, key=lambda item: int(item["LineID"])):
            line_id = int(row["LineID"])
            if line_id in seen_lines:
                continue
            seen_lines.add(line_id)
            color = clean_text(row.get("color_code")).lower() or "unknown"
            order = int(row.get("stationOrder") or 0)
            line_refs.append(
                StationLine(
                    line_code=line_code_for(line_id),
                    line_id=line_id,
                    line_name=clean_text(row.get("eng_linename")).title(),
                    line_name_kn=clean_text(row.get("kan_linename")),
                    color=color,
                    color_hex=color_hex(color),
                    order=order,
                )
            )
            by_line.setdefault(line_id, []).append((order, code))

        lat = named.get("latitude")
        lng = named.get("longitude")
        stations[code] = Station(
            code=code,
            name=clean_text(named.get("vStationName")),
            name_kn=clean_text(named.get("vStationNameK")),
            latitude=float(lat) if lat not in (None, "") else None,
            longitude=float(lng) if lng not in (None, "") else None,
            interchange=len(line_refs) > 1,
            lines=line_refs,
        )

    lines: list[LineDetail] = []
    for line_id, members in sorted(by_line.items()):
        members.sort(key=lambda item: (item[0], item[1]))
        ordered = [stations[code] for _, code in members]
        sample = ordered[0].lines[0]
        for station in ordered:
            for ref in station.lines:
                if ref.line_id == line_id:
                    sample = ref
                    break
        lines.append(
            LineDetail(
                code=line_code_for(line_id),
                line_id=line_id,
                name=sample.line_name,
                name_kn=sample.line_name_kn,
                color=sample.color,
                color_hex=sample.color_hex,
                station_count=len(ordered),
                stations=ordered,
            )
        )

    return Catalog(
        stations=stations,
        lines=lines,
        fetched_at=time.time(),
        source="live",
    )


def read_snapshot(path=None) -> Catalog:
    target = path or settings.bmrc_snapshot_path
    payload = json.loads(target.read_text(encoding="utf-8"))
    rows = payload["results"] if isinstance(payload, dict) else payload
    catalog = normalize_rows(rows, load_interchange_aliases())
    catalog.source = "snapshot"
    return catalog


@dataclass
class CatalogCache:
    ttl_seconds: float
    client: BmrcClient
    current: Catalog | None = None
    aliases: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.aliases = load_interchange_aliases()

    async def get(self) -> Catalog:
        now = time.time()
        if self.current is not None and now - self.current.fetched_at < self.ttl_seconds:
            return self.current
        try:
            payload = await self.client.get_json("/users/master/getStations")
            rows = payload["results"]
            if not isinstance(rows, list) or not rows:
                raise UpstreamApiError("BMRCL station list was empty.")
            catalog = normalize_rows(rows, self.aliases)
            catalog.source = "live"
            self.current = catalog
            return catalog
        except (UpstreamApiError, KeyError, TypeError, ValueError):
            if self.current is not None:
                return self.current
            catalog = read_snapshot()
            self.current = catalog
            return catalog


def search_stations(catalog: Catalog, query: str) -> list[Station]:
    needle = query.strip().casefold()
    stations = list(catalog.stations.values())
    stations.sort(key=lambda station: station.name.casefold())
    if not needle:
        return stations
    return [
        station
        for station in stations
        if needle in station.name.casefold() or needle in station.name_kn.casefold()
    ]
