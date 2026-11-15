"""Path finding on the line graph. No HTTP.

Nodes are station codes. Consecutive orders on a line are an edge of one hop.
An interchange is one node, so changing lines there does not add a hop.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass

from core.errors import ApiRequestError
from schemas.journey import JourneyLeg, StationRef, Strategy
from schemas.station import Station, StationLine
from services.catalog import Catalog


@dataclass(frozen=True)
class Edge:
    line_id: int
    neighbor: str


@dataclass
class PathResult:
    codes: list[str]
    line_ids: list[int]
    interchanges: int
    hops: int


def build_adjacency(catalog: Catalog) -> dict[str, list[Edge]]:
    graph: dict[str, list[Edge]] = {code: [] for code in catalog.stations}
    for line in catalog.lines:
        ordered = sorted(
            (
                (ref.order, station.code)
                for station in line.stations
                for ref in station.lines
                if ref.line_id == line.line_id
            ),
            key=lambda item: (item[0], item[1]),
        )
        for (_, left), (_, right) in zip(ordered, ordered[1:]):
            if left == right:
                continue
            graph[left].append(Edge(line.line_id, right))
            graph[right].append(Edge(line.line_id, left))
    return graph


def _rank(
    strategy: Strategy,
    hops: int,
    changes: int,
    codes: tuple[str, ...],
) -> tuple:
    if strategy == "minimum-interchange":
        return (changes, hops, codes)
    return (hops, changes, codes)


def _line_on(station: Station, line_id: int) -> StationLine:
    for ref in station.lines:
        if ref.line_id == line_id:
            return ref
    raise ApiRequestError(
        f"Station {station.code} is not on line {line_id}.",
        status_code=500,
    )


def find_path(
    catalog: Catalog,
    origin: str,
    destination: str,
    strategy: Strategy,
) -> PathResult:
    if origin == destination:
        raise ApiRequestError(
            "Origin and destination are the same station.",
            status_code=400,
        )
    if origin not in catalog.stations or destination not in catalog.stations:
        missing = origin if origin not in catalog.stations else destination
        raise ApiRequestError(f"Unknown station code {missing}.", status_code=404)

    graph = build_adjacency(catalog)
    # best[(station, arrival line)] = (hops, changes, codes, line ids of each hop)
    start_codes = (origin,)
    start_lines: tuple[int, ...] = ()
    best: dict[tuple[str, int | None], tuple[int, int, tuple[str, ...], tuple[int, ...]]] = {
        (origin, None): (0, 0, start_codes, start_lines)
    }
    heap: list[tuple] = [(_rank(strategy, 0, 0, start_codes), 0, 0, origin, None, start_codes, start_lines)]
    winner: tuple[int, int, tuple[str, ...], tuple[int, ...]] | None = None

    while heap:
        rank, hops, changes, station, line_id, codes, line_ids = heapq.heappop(heap)
        recorded = best[(station, line_id)]
        if (hops, changes, codes, line_ids) != recorded:
            continue
        if station == destination:
            if winner is None or rank < _rank(strategy, winner[0], winner[1], winner[2]):
                winner = (hops, changes, codes, line_ids)
            continue
        if winner is not None:
            winner_rank = _rank(strategy, winner[0], winner[1], winner[2])
            if rank[:2] > winner_rank[:2]:
                break

        for edge in graph[station]:
            if edge.neighbor in codes:
                continue
            next_hops = hops + 1
            next_changes = changes
            if line_id is not None and edge.line_id != line_id:
                next_changes += 1
            next_codes = codes + (edge.neighbor,)
            next_lines = line_ids + (edge.line_id,)
            state = (edge.neighbor, edge.line_id)
            candidate = (next_hops, next_changes, next_codes, next_lines)
            previous = best.get(state)
            cand_rank = _rank(strategy, next_hops, next_changes, next_codes)
            if previous is not None and cand_rank >= _rank(strategy, previous[0], previous[1], previous[2]):
                continue
            best[state] = candidate
            heapq.heappush(
                heap,
                (cand_rank, next_hops, next_changes, edge.neighbor, edge.line_id, next_codes, next_lines),
            )

    if winner is None:
        raise ApiRequestError(
            f"No path from {origin} to {destination}.",
            status_code=404,
        )

    codes = list(winner[2])
    line_ids = list(winner[3])
    if len(codes) != len(set(codes)):
        raise ApiRequestError("Path revisited a station.", status_code=500)
    changes = sum(1 for left, right in zip(line_ids, line_ids[1:]) if left != right)
    return PathResult(codes=codes, line_ids=line_ids, interchanges=changes, hops=len(codes) - 1)


def ref_for(station: Station) -> StationRef:
    return StationRef(code=station.code, name=station.name, name_kn=station.name_kn)


def legs_from_path(catalog: Catalog, path: PathResult) -> tuple[list[JourneyLeg], list[StationRef]]:
    legs: list[JourneyLeg] = []
    interchanges: list[StationRef] = []
    start = 0
    for index in range(1, len(path.line_ids) + 1):
        ended = index == len(path.line_ids) or path.line_ids[index] != path.line_ids[start]
        if not ended:
            continue
        line_id = path.line_ids[start]
        slice_codes = path.codes[start : index + 1]
        sample = _line_on(catalog.stations[slice_codes[0]], line_id)
        stations = [ref_for(catalog.stations[code]) for code in slice_codes]
        legs.append(
            JourneyLeg(
                line_code=sample.line_code,
                line_name=sample.line_name,
                line_name_kn=sample.line_name_kn,
                color=sample.color,
                color_hex=sample.color_hex,
                from_station=stations[0],
                to_station=stations[-1],
                stations=stations,
                hop_count=len(stations) - 1,
            )
        )
        if index != len(path.line_ids):
            interchanges.append(stations[-1])
        start = index
    return legs, interchanges
