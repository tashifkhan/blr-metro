import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.errors import UpstreamApiError
from services.catalog import read_snapshot

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def client(monkeypatch):
    import main

    snapshot = read_snapshot(FIXTURES / "stations.json")
    fare = json.loads((FIXTURES / "fare_success.json").read_text(encoding="utf-8"))

    async def get_catalog():
        return snapshot

    async def quote(*_args, **_kwargs):
        return fare["results"]

    monkeypatch.setattr(main.catalog_cache, "get", get_catalog)
    monkeypatch.setattr(main.fare_cache, "quote", quote)
    with TestClient(main.app) as test_client:
        yield test_client


def test_lines_search_and_plan(client: TestClient):
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    lines = client.get("/api/v1/lines")
    assert lines.status_code == 200
    assert [line["code"] for line in lines.json()] == ["PL", "GL", "YL", "PK"]

    purple = client.get("/api/v1/lines/PL/stations")
    assert purple.status_code == 200
    assert purple.json()["stations"][0]["code"] == "WHTM"

    search = client.get("/api/v1/stations/search", params={"query": ""})
    assert search.status_code == 200
    assert len(search.json()) == 88

    missing = client.get("/api/v1/stations/NOPE")
    assert missing.status_code == 404
    assert missing.json()["upstream_status_code"] is None

    plan = client.get(
        "/api/v1/journeys/plan",
        params={"from_station_code": "WHTM", "to_station_code": "CBPK"},
    )
    assert plan.status_code == 200
    body = plan.json()
    assert body["fare"]["token"] == 70
    assert body["station_count"] == 19
    assert body["strategies_differ"] is False


def test_same_station_does_not_call_fare(client: TestClient, monkeypatch):
    import main

    async def boom(*_args, **_kwargs):
        raise AssertionError("fare should not be called")

    monkeypatch.setattr(main.fare_cache, "quote", boom)
    response = client.get(
        "/api/v1/journeys/plan",
        params={"from_station_code": "RVR", "to_station_code": "RVR"},
    )
    assert response.status_code == 400
    assert response.json()["upstream_status_code"] is None


def test_fare_failure_is_502(client: TestClient, monkeypatch):
    import main

    async def fail(*_args, **_kwargs):
        raise UpstreamApiError("BMRCL did not return a fare.", status_code=500)

    monkeypatch.setattr(main.fare_cache, "quote", fail)
    response = client.get(
        "/api/v1/journeys/plan",
        params={"from_station_code": "WHTM", "to_station_code": "CBPK"},
    )
    assert response.status_code == 502
    assert response.json()["upstream_status_code"] == 500


def test_maps_list(client: TestClient):
    response = client.get("/api/v1/maps")
    assert response.status_code == 200
    assert {item["family"] for item in response.json()} == {"phase", "schematic"}
