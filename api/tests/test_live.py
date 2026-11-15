"""One live fare check. Off unless BMRC_LIVE=1."""

import pytest

from core.config import settings

pytestmark = pytest.mark.skipif(not settings.bmrc_live, reason="set BMRC_LIVE=1 to call BMRCL")


@pytest.mark.asyncio
async def test_whitefield_to_cubbon_park_shape():
    from clients.bmrc import bmrc_client
    from services.catalog import CatalogCache
    from services.planner import FareCache, plan_journey

    cache = CatalogCache(ttl_seconds=0, client=bmrc_client)
    fares = FareCache(ttl_seconds=0, client=bmrc_client)
    try:
        catalog = await cache.get()
        plan = await plan_journey(catalog, fares, "WHTM", "CBPK", "least-distance")
    except Exception as exc:
        pytest.skip(f"BMRCL unreachable: {exc}")
    finally:
        await bmrc_client.close()

    assert plan.fare.source == "bmrc"
    assert plan.fare.token >= plan.fare.smart_card_peak >= plan.fare.smart_card_off_peak
    assert plan.station_count == 19
    assert plan.legs[0].line_code == "PL"
