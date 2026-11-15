"""A path from the graph, then one live fare call."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from clients.bmrc import BmrcClient
from core.errors import UpstreamApiError
from schemas.journey import Fare, JourneyPlan, Parking, Strategy
from schemas.station import Station
from services.catalog import Catalog
from services.graph import find_path, legs_from_path, ref_for


def _number(value: object) -> float:
    if value is None or value == "":
        raise UpstreamApiError("BMRCL fare response omitted a price.")
    return float(value)


def _optional_int(value: object) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


@dataclass
class FareCache:
    ttl_seconds: float
    client: BmrcClient
    entries: dict[tuple[str, str, str, str], tuple[float, dict]] = field(default_factory=dict)

    async def quote(self, origin: Station, origin_line: int, destination: Station, destination_line: int) -> dict:
        key = (origin.code, str(origin_line), destination.code, str(destination_line))
        now = time.time()
        cached = self.entries.get(key)
        if cached is not None and now - cached[0] < self.ttl_seconds:
            return cached[1]
        payload = await self.client.post_json(
            "/users/fare/get-fare-details",
            {
                "from": {"value": origin.code, "groupId": str(origin_line)},
                "to": {"value": destination.code, "groupId": str(destination_line)},
            },
        )
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, dict) or results.get("TValue") is None:
            message = ""
            if isinstance(payload, dict):
                message = str(payload.get("messages") or payload.get("resultMsg") or "")
            raise UpstreamApiError(
                message or "BMRCL did not return a fare.",
            )
        self.entries[key] = (now, results)
        return results


def _strategies_differ(catalog: Catalog, origin: str, destination: str) -> bool:
    least = find_path(catalog, origin, destination, "least-distance")
    minimum = find_path(catalog, origin, destination, "minimum-interchange")
    return least.codes != minimum.codes


async def plan_journey(
    catalog: Catalog,
    fares: FareCache,
    origin_code: str,
    destination_code: str,
    strategy: Strategy,
) -> JourneyPlan:
    origin_code = origin_code.strip().upper()
    destination_code = destination_code.strip().upper()
    path = find_path(catalog, origin_code, destination_code, strategy)
    legs, interchanges = legs_from_path(catalog, path)
    origin = catalog.stations[origin_code]
    destination = catalog.stations[destination_code]
    origin_line = path.line_ids[0]
    destination_line = path.line_ids[-1]
    raw = await fares.quote(origin, origin_line, destination, destination_line)
    parking = Parking(
        station_code=origin.code,
        station_name=origin.name,
        two_wheeler=_optional_int(raw.get("vTwoWheeler")),
        four_wheeler=_optional_int(raw.get("vFourWheeler")),
        lcv=_optional_int(raw.get("vLCV")),
    )
    return JourneyPlan(
        from_station=ref_for(origin),
        to_station=ref_for(destination),
        strategy=strategy,
        strategies_differ=_strategies_differ(catalog, origin_code, destination_code),
        station_count=path.hops,
        legs=legs,
        interchanges=interchanges,
        fare=Fare(
            zone=str(raw.get("FareZone") or ""),
            token=_number(raw.get("TValue")),
            smart_card_peak=_number(raw.get("PeakCSCValue")),
            smart_card_off_peak=_number(raw.get("CSCValue")),
            group_ticket=_number(raw.get("GTValue")),
        ),
        parking_at_origin=parking,
    )
