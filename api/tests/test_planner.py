import json
from pathlib import Path

import httpx
import pytest

from clients.bmrc import BmrcClient
from core.errors import UpstreamApiError
from services.catalog import normalize_rows
from services.news import _absolute, list_news
from services.planner import FareCache, plan_journey

FIXTURES = Path(__file__).parent / "fixtures"


def catalog():
    payload = json.loads((FIXTURES / "stations.json").read_text(encoding="utf-8"))
    return normalize_rows(payload["results"])


def test_plan_uses_recorded_fare_and_origin_parking():
    recorded = json.loads((FIXTURES / "fare_success.json").read_text(encoding="utf-8"))

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body == {
            "from": {"value": "WHTM", "groupId": "1"},
            "to": {"value": "CBPK", "groupId": "1"},
        }
        return httpx.Response(200, json=recorded)

    client = BmrcClient(
        httpx.AsyncClient(
            base_url="https://english.bmrc.co.in:8282/api",
            transport=httpx.MockTransport(handler),
        )
    )
    fares = FareCache(ttl_seconds=900, client=client)

    async def run():
        plan = await plan_journey(catalog(), fares, "whtm", "cbpk", "least-distance")
        await client.close()
        return plan

    import asyncio

    plan = asyncio.run(run())
    assert plan.fare.token == 70
    assert plan.fare.smart_card_peak == 66.5
    assert plan.fare.zone == "F7"
    assert plan.fare.source == "bmrc"
    assert plan.station_count == 19
    assert plan.strategies_differ is False
    assert plan.parking_at_origin is not None
    assert plan.parking_at_origin.station_code == "WHTM"
    assert plan.parking_at_origin.two_wheeler == 204


def test_fare_error_body_is_a_502():
    recorded = json.loads((FIXTURES / "fare_error.json").read_text(encoding="utf-8"))

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=recorded)

    client = BmrcClient(
        httpx.AsyncClient(
            base_url="https://english.bmrc.co.in:8282/api",
            transport=httpx.MockTransport(handler),
        )
    )
    fares = FareCache(ttl_seconds=0, client=client)

    async def run():
        with pytest.raises(UpstreamApiError):
            await plan_journey(catalog(), fares, "WHTM", "CBPK", "least-distance")
        await client.close()

    import asyncio

    asyncio.run(run())


def test_cross_line_fare_uses_the_line_at_each_end():
    recorded = json.loads((FIXTURES / "fare_success.json").read_text(encoding="utf-8"))
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=recorded)

    client = BmrcClient(
        httpx.AsyncClient(
            base_url="https://english.bmrc.co.in:8282/api",
            transport=httpx.MockTransport(handler),
        )
    )
    fares = FareCache(ttl_seconds=0, client=client)

    async def run():
        await plan_journey(catalog(), fares, "IDN", "ETCT", "least-distance")
        await client.close()

    import asyncio

    asyncio.run(run())
    assert seen["body"]["from"] == {"value": "IDN", "groupId": "1"}
    assert seen["body"]["to"] == {"value": "ETCT", "groupId": "3"}


def test_news_urls_are_absolute_and_deduped():
    blob = json.loads((FIXTURES / "news.json").read_text(encoding="utf-8"))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("latestnews"):
            return httpx.Response(200, json=blob["latest"])
        return httpx.Response(200, json=blob["marquee"])

    client = BmrcClient(
        httpx.AsyncClient(
            base_url="https://english.bmrc.co.in:8282/api",
            transport=httpx.MockTransport(handler),
        )
    )

    async def run():
        items = await list_news(client)
        await client.close()
        return items

    import asyncio

    items = asyncio.run(run())
    ids = [item.id for item in items]
    assert len(ids) == len(set(ids))
    reach = next(item for item in items if item.id == 19)
    assert reach.pdf_url == (
        "https://english.bmrc.co.in:8282/English/uploads/news/english/"
        "fileuploads/1728135762487$@!!REACH-5_STATES%20as%20on%2005.10.2024.pdf"
    )
    assert reach.pdf_url_kn == (
        "https://english.bmrc.co.in:8282/Kannada/uploads/news/kannada/"
        "fileuploads/1728135762878$@!!Reach-5%20Status-Kannada%20as%20on%2005.10.2024.pdf"
    )
    meeting = next(item for item in items if item.id == 31)
    assert meeting.pdf_url == (
        "https://english.bmrc.co.in:8282/English/uploads/news/english/"
        "fileuploads/1773832814191$@!!I-Metro.pdf"
    )
    assert meeting.pdf_url_kn == (
        "https://english.bmrc.co.in:8282/Kannada/uploads/news/kannada/"
        "fileuploads/1773832814218$@!!I-Metro.pdf"
    )
    older = next(item for item in items if item.id == 4)
    assert older.pdf_url == (
        "https://english.bmrc.co.in:8282/English/uploads/news/english/"
        "FileUploads/4663ad81-5404-4c7d-afdb-8521f06ae642$@!!@$news%203.pdf"
    )


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        (None, None),
        ("  ", None),
        (123, None),
        (
            "fileuploads/news%20report.pdf",
            "https://english.bmrc.co.in:8282/English/uploads/news/english/fileuploads/news%20report.pdf",
        ),
        (
            "/English/uploads/news/english/fileuploads/news.pdf",
            "https://english.bmrc.co.in:8282/English/uploads/news/english/fileuploads/news.pdf",
        ),
        ("https://example.com/news%20report.pdf", "https://example.com/news%20report.pdf"),
    ],
)
def test_news_url_preserves_existing_urls_and_encoded_filenames(path, expected):
    assert _absolute(path) == expected
