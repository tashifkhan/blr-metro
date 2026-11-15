"""News list. PDF paths on the fare host are turned into absolute URLs."""

from urllib.parse import urljoin, urlsplit

from clients.bmrc import BmrcClient
from core.config import settings
from schemas.news import NewsItem


def _file_root() -> str:
    parts = urlsplit(str(settings.bmrc_base_url))
    return f"{parts.scheme}://{parts.netloc}"


def _absolute(path: object) -> str | None:
    if not path or not isinstance(path, str):
        return None
    text = path.strip()
    if not text:
        return None
    if text.startswith("http://") or text.startswith("https://"):
        return text
    # Uploads live on the host root, not under /api.
    return urljoin(_file_root() + "/", text)


def _item(row: dict) -> NewsItem | None:
    raw_id = row.get("Id")
    if raw_id is None:
        return None
    return NewsItem(
        id=int(raw_id),
        title=str(row.get("NewsDescriptionEng") or row.get("engLinkText") or "").strip(),
        title_kn=str(row.get("NewsDescriptionKan") or row.get("kanLinkText") or "").strip(),
        from_date=row.get("from_date"),
        to_date=row.get("to_date"),
        marquee=bool(row.get("is_marquee")),
        latest=bool(row.get("is_latestnews")),
        pdf_url=_absolute(row.get("eng_file_source")),
        pdf_url_kn=_absolute(row.get("kan_file_source")),
    )


async def list_news(client: BmrcClient) -> list[NewsItem]:
    latest = await client.get_json("/users/news/getNewDetails/latestnews")
    marquee = await client.get_json("/users/news/getNewDetails/marquee")
    merged: dict[int, NewsItem] = {}
    for payload in (latest, marquee):
        rows = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            continue
        for row in rows:
            item = _item(row)
            if item is None:
                continue
            existing = merged.get(item.id)
            if existing is None:
                merged[item.id] = item
                continue
            merged[item.id] = existing.model_copy(
                update={
                    "marquee": existing.marquee or item.marquee,
                    "latest": existing.latest or item.latest,
                    "pdf_url": existing.pdf_url or item.pdf_url,
                    "pdf_url_kn": existing.pdf_url_kn or item.pdf_url_kn,
                }
            )
    return sorted(merged.values(), key=lambda item: item.id, reverse=True)
