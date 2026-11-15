from typing import Literal

from fastapi import APIRouter, Query

from schemas.journey import JourneyPlan
from services.catalog import CatalogCache
from services.planner import FareCache, plan_journey

router = APIRouter(prefix="/journeys", tags=["journeys"])


def bind(cache: CatalogCache, fares: FareCache) -> APIRouter:
    @router.get("/plan", response_model=JourneyPlan)
    async def plan(
        from_station_code: str = Query(..., min_length=1),
        to_station_code: str = Query(..., min_length=1),
        strategy: Literal["least-distance", "minimum-interchange"] = "least-distance",
    ) -> JourneyPlan:
        catalog = await cache.get()
        return await plan_journey(
            catalog,
            fares,
            from_station_code,
            to_station_code,
            strategy,
        )

    return router
