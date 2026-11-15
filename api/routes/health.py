from fastapi import APIRouter

from services.catalog import CatalogCache

router = APIRouter(tags=["health"])


def bind(cache: CatalogCache) -> APIRouter:
    @router.get("/health")
    async def health() -> dict:
        catalog = cache.current
        return {
            "status": "ok",
            "stations": None if catalog is None else len(catalog.stations),
            "catalog_source": None if catalog is None else catalog.source,
        }

    return router
