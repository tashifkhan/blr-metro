from fastapi import APIRouter
from fastapi.responses import Response

from clients.bmrc import BmrcClient
from core.config import settings
from core.errors import ApiRequestError
from schemas.news import MapAsset
from services.maps import MAPS

router = APIRouter(prefix="/maps", tags=["maps"])


def bind(client: BmrcClient) -> APIRouter:
    @router.get("", response_model=list[MapAsset])
    async def list_maps() -> list[MapAsset]:
        return list(MAPS.values())

    @router.get("/{family}/file")
    async def map_file(family: str) -> Response:
        asset = MAPS.get(family)
        if asset is None:
            raise ApiRequestError(f"Unknown map {family}.", status_code=404)
        content, media = await client.get_bytes(
            asset.source_url,
            settings.map_download_max_bytes,
        )
        return Response(
            content=content,
            media_type=media if media.startswith("image/") else asset.content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )

    return router
