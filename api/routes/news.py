from fastapi import APIRouter

from clients.bmrc import BmrcClient
from schemas.news import NewsItem
from services.news import list_news

router = APIRouter(tags=["news"])


def bind(client: BmrcClient) -> APIRouter:
    @router.get("/news", response_model=list[NewsItem])
    async def news() -> list[NewsItem]:
        return await list_news(client)

    return router
