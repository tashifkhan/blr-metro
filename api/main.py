"""Namma Metro API.

    uv run uvicorn main:app --reload --port 8091
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from clients.bmrc import bmrc_client
from core.analytics import AnalyticsMiddleware
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from routes import health, journeys, lines, maps, news, stations
from schemas.common import ApiErrorResponse
from services.catalog import CatalogCache
from services.planner import FareCache

API_V1_PREFIX = "/api/v1"

catalog_cache = CatalogCache(
    ttl_seconds=settings.bmrc_catalog_ttl_seconds,
    client=bmrc_client,
)
fare_cache = FareCache(
    ttl_seconds=settings.bmrc_fare_ttl_seconds,
    client=bmrc_client,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await catalog_cache.get()
    except Exception:
        # A dead upstream at boot is fine. The snapshot loads on the first call
        # that needs it, and a later call retries the live list.
        pass
    yield
    await bmrc_client.close()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    debug=settings.debug,
    lifespan=lifespan,
    responses={
        400: {"model": ApiErrorResponse, "description": "Invalid request."},
        404: {"model": ApiErrorResponse, "description": "Resource not found."},
        502: {"model": ApiErrorResponse, "description": "BMRCL request failed."},
    },
)

# Expo web on localhost talks to this process on another port. Production web
# uses the Worker proxy and never needs this.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["GET"],
    allow_headers=["*"],
)

# One OTLP span per request when OTEL_EXPORTER_OTLP_ENDPOINT is set (Honeycomb
# in production). Added last, so it is outermost and sees every response.
app.add_middleware(AnalyticsMiddleware, api="blr-metro")


@app.exception_handler(UpstreamApiError)
async def handle_upstream_error(_: Request, exc: UpstreamApiError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"detail": exc.message, "upstream_status_code": exc.status_code},
    )


@app.exception_handler(ApiRequestError)
async def handle_request_error(_: Request, exc: ApiRequestError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "upstream_status_code": None},
    )


app.include_router(health.bind(catalog_cache), prefix=API_V1_PREFIX)
app.include_router(lines.bind(catalog_cache), prefix=API_V1_PREFIX)
app.include_router(stations.bind(catalog_cache), prefix=API_V1_PREFIX)
app.include_router(journeys.bind(catalog_cache, fare_cache), prefix=API_V1_PREFIX)
app.include_router(news.bind(bmrc_client), prefix=API_V1_PREFIX)
app.include_router(maps.bind(bmrc_client), prefix=API_V1_PREFIX)
