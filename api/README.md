# Namma Metro API

Lines, stations, and a journey plan for Namma Metro. Station names and prices come from the public BMRCL site. The stations in between are computed here, because that site returns a fare and not a route.

## Run

```bash
cd api
uv sync --group dev
uv run uvicorn main:app --reload --port 8091
```

OpenAPI is at `http://127.0.0.1:8091/docs`.

```bash
curl -s 'http://127.0.0.1:8091/api/v1/journeys/plan?from_station_code=WHTM&to_station_code=CBPK' | jq
```

Whitefield to Cubbon Park stays on Purple. Indiranagar (`IDN`) to Electronic City (`ETCT`) changes at Majestic (`KGWA`) and RV Road (`RVR`).

`strategy` is `least-distance` (default) or `minimum-interchange`. On the current graph those two answers match, and the response says so in `strategies_differ`.

## Settings

Copy `.env.example` if you want to override anything. The bearer token is the one compiled into `english.bmrc.co.in`. It is a published client key, not a user secret.

| Variable | Default |
| --- | --- |
| `BMRC_BASE_URL` | `https://english.bmrc.co.in:8282/api` |
| `BMRC_API_KEY` | token from the public site bundle |
| `BMRC_ORIGIN` | `https://english.bmrc.co.in` |
| `BMRC_TIMEOUT_SECONDS` | `15` |
| `BMRC_CATALOG_TTL_SECONDS` | `900` |
| `BMRC_FARE_TTL_SECONDS` | `900` |

If the live station list fails, the process serves `data/stations.snapshot.json`. Refresh that file when the network changes:

```bash
uv run python scripts/refresh_station_snapshot.py
```

`data/interchanges.json` maps an extra station code onto one we already have. It is empty. Use it only if BMRCL gives the same physical station two codes.

## Tests

```bash
uv run pytest
```

The live fare test stays off unless `BMRC_LIVE=1`. It checks the shape of Whitefield to Cubbon Park and does not pin the rupee amounts.

See `docs/bmrc-api.md` for what the upstream calls return.
