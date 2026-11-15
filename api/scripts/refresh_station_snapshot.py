"""Write data/stations.snapshot.json from a live station fetch.

Run from api/:

    uv run python scripts/refresh_station_snapshot.py
"""

import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import settings  # noqa: E402


def main() -> None:
    response = httpx.get(
        str(settings.bmrc_base_url).rstrip("/") + "/users/master/getStations",
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {settings.bmrc_api_key}",
            "Origin": settings.bmrc_origin,
            "Referer": f"{settings.bmrc_origin}/",
        },
        timeout=settings.bmrc_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    rows = payload.get("results") or []
    settings.bmrc_snapshot_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} rows to {settings.bmrc_snapshot_path}")


if __name__ == "__main__":
    main()
