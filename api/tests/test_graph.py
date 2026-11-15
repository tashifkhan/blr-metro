import json
from pathlib import Path

import pytest

from core.errors import ApiRequestError
from services.catalog import normalize_rows
from services.graph import find_path, legs_from_path

FIXTURES = Path(__file__).parent / "fixtures"


def catalog():
    payload = json.loads((FIXTURES / "stations.json").read_text(encoding="utf-8"))
    return normalize_rows(payload["results"])


def test_same_line_hop_count_matches_order_gap():
    found = catalog()
    path = find_path(found, "WHTM", "CBPK", "least-distance")
    assert path.hops == 19
    assert path.interchanges == 0
    assert set(path.line_ids) == {1}
    legs, interchanges = legs_from_path(found, path)
    assert len(legs) == 1
    assert legs[0].line_code == "PL"
    assert legs[0].stations[0].code == "WHTM"
    assert legs[0].stations[-1].code == "CBPK"
    assert interchanges == []
    assert len(path.codes) == len(set(path.codes))


def test_two_changes_via_majestic_and_rv_road():
    found = catalog()
    path = find_path(found, "IDN", "ETCT", "least-distance")
    assert path.codes[0] == "IDN"
    assert "KGWA" in path.codes
    assert "RVR" in path.codes
    assert path.codes[-1] == "ETCT"
    assert path.interchanges == 2
    legs, interchanges = legs_from_path(found, path)
    assert [leg.line_code for leg in legs] == ["PL", "GL", "YL"]
    assert [stop.code for stop in interchanges] == ["KGWA", "RVR"]
    # The shared station is the end of one leg and the start of the next, once.
    assert legs[0].stations[-1].code == "KGWA"
    assert legs[1].stations[0].code == "KGWA"
    assert path.hops == len(path.codes) - 1


def test_trip_from_an_interchange_does_not_invent_one():
    found = catalog()
    path = find_path(found, "KGWA", "IDN", "least-distance")
    assert path.interchanges == 0
    _, interchanges = legs_from_path(found, path)
    assert interchanges == []
    assert path.codes[0] == "KGWA"
    assert path.line_ids[0] == 1


def test_same_station_is_rejected_even_across_lines():
    found = catalog()
    with pytest.raises(ApiRequestError) as caught:
        find_path(found, "RVR", "RVR", "minimum-interchange")
    assert caught.value.status_code == 400


def test_pink_spur_changes_at_jayadeva():
    found = catalog()
    path = find_path(found, "SGRC", "BTML", "least-distance")
    legs, interchanges = legs_from_path(found, path)
    assert [leg.line_code for leg in legs] == ["PK", "YL"]
    assert [stop.code for stop in interchanges] == ["JDHP"]
    assert path.hops == 2


def test_unknown_code_is_404():
    found = catalog()
    with pytest.raises(ApiRequestError) as caught:
        find_path(found, "NOPE", "WHTM", "least-distance")
    assert caught.value.status_code == 404
