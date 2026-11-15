from fastapi import APIRouter, Query

from schemas.station import Station
from services.catalog import CatalogCache, search_stations

router = APIRouter(prefix="/stations", tags=["stations"])


def bind(cache: CatalogCache) -> APIRouter:
    @router.get("/search", response_model=list[Station])
    async def search(query: str = Query(default="")) -> list[Station]:
        catalog = await cache.get()
        return search_stations(catalog, query)

    @router.get("/{station_code}", response_model=Station)
    async def station(station_code: str) -> Station:
        catalog = await cache.get()
        return catalog.station(station_code)

    return router
