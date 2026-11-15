import json
from pathlib import Path

from services.catalog import line_code_for, normalize_rows, search_stations

FIXTURES = Path(__file__).parent / "fixtures"


def catalog():
    payload = json.loads((FIXTURES / "stations.json").read_text(encoding="utf-8"))
    return normalize_rows(payload["results"])


def test_dedupes_interchange_rows():
    found = catalog()
    assert len(found.stations) == 88
    majestic = found.stations["KGWA"]
    assert majestic.interchange
    assert [line.line_code for line in majestic.lines] == ["PL", "GL"]
    assert "\n" not in majestic.name_kn
    assert "\r" not in majestic.name_kn
    jayadeva = found.stations["JDHP"]
    assert [line.line_code for line in jayadeva.lines] == ["YL", "PK"]


def test_line_counts_and_order():
    found = catalog()
    by_code = {line.code: line for line in found.lines}
    assert [line.code for line in found.lines] == ["PL", "GL", "YL", "PK"]
    assert by_code["PL"].station_count == 37
    assert by_code["GL"].station_count == 32
    assert by_code["YL"].station_count == 16
    assert by_code["PK"].station_count == 6
    purple = [station.code for station in by_code["PL"].stations]
    assert purple[0] == "WHTM"
    assert purple.index("CBPK") - purple.index("WHTM") == 19
    assert by_code["PK"].color_hex == "#E31C79"


def test_unknown_line_id_does_not_crash():
    payload = json.loads((FIXTURES / "stations.json").read_text(encoding="utf-8"))
    extra = dict(payload["results"][0])
    extra["LineID"] = 9
    extra["vStationCode"] = "FUTR"
    extra["vStationName"] = "Future Halt"
    extra["eng_linename"] = "TEAL LINE"
    extra["color_code"] = "teal"
    extra["stationOrder"] = 1
    found = normalize_rows(payload["results"] + [extra])
    assert line_code_for(9) == "L9"
    line = next(item for item in found.lines if item.code == "L9")
    assert line.color == "teal"
    assert line.color_hex is None
    assert found.stations["FUTR"].lines[0].line_code == "L9"


def test_alias_merges_a_second_code():
    payload = json.loads((FIXTURES / "stations.json").read_text(encoding="utf-8"))
    extra = dict(payload["results"][0])
    extra["vStationCode"] = "KGWB"
    extra["LineID"] = 9
    extra["stationOrder"] = 1
    extra["eng_linename"] = "TEAL LINE"
    extra["color_code"] = "teal"
    found = normalize_rows(payload["results"] + [extra], {"KGWB": "KGWA"})
    assert "KGWB" not in found.stations
    assert any(line.line_code == "L9" for line in found.stations["KGWA"].lines)


def test_search_matches_english_kannada_and_empty_query():
    found = catalog()
    english = search_stations(found, "whitefield")
    assert [station.code for station in english] == ["WHTM"]
    kannada = search_stations(found, "ವೈಟ್")
    assert [station.code for station in kannada] == ["WHTM"]
    everyone = search_stations(found, "  ")
    assert len(everyone) == len(found.stations)
    assert len({station.code for station in everyone}) == len(everyone)
