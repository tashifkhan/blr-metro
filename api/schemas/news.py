from pydantic import BaseModel


class NewsItem(BaseModel):
    id: int
    title: str
    title_kn: str
    from_date: str | None = None
    to_date: str | None = None
    marquee: bool
    latest: bool
    pdf_url: str | None = None
    pdf_url_kn: str | None = None


class MapAsset(BaseModel):
    family: str
    title: str
    content_type: str
    source_url: str
