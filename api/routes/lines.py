from fastapi import APIRouter

from schemas.station import Line, LineDetail
from services.catalog import CatalogCache

router = APIRouter(prefix="/lines", tags=["lines"])


def bind(cache: CatalogCache) -> APIRouter:
    @router.get("", response_model=list[Line])
    async def list_lines() -> list[Line]:
        catalog = await cache.get()
        lines: list[Line] = []
        for line in catalog.lines:
            summary = Line.model_validate(line.model_dump())
            if line.stations:
                summary.start_station = line.stations[0].name
                summary.end_station = line.stations[-1].name
            lines.append(summary)
        return lines

    @router.get("/{line_code}/stations", response_model=LineDetail)
    async def line_stations(line_code: str) -> LineDetail:
        catalog = await cache.get()
        return catalog.line(line_code)

    return router
