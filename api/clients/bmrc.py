"""The only place this process talks to english.bmrc.co.in."""

from typing import Any

import httpx

from core.config import settings
from core.errors import UpstreamApiError


class BmrcClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=str(settings.bmrc_base_url),
                timeout=settings.bmrc_timeout_seconds,
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {settings.bmrc_api_key}",
                    "Origin": settings.bmrc_origin,
                    "Referer": f"{settings.bmrc_origin}/",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def get_json(self, path: str) -> Any:
        try:
            response = await self._http().get(path)
        except httpx.HTTPError as exc:
            raise UpstreamApiError(f"BMRCL request failed: {exc}") from exc
        return self._decode(response, path)

    async def post_json(self, path: str, body: dict[str, Any]) -> Any:
        try:
            response = await self._http().post(path, json=body)
        except httpx.HTTPError as exc:
            raise UpstreamApiError(f"BMRCL request failed: {exc}") from exc
        return self._decode(response, path)

    async def get_bytes(self, url: str, max_bytes: int) -> tuple[bytes, str]:
        """Fetch an absolute map URL. The fare host is not the image host."""

        try:
            response = await self._http().get(url)
        except httpx.HTTPError as exc:
            raise UpstreamApiError(f"BMRCL file request failed: {exc}") from exc
        if response.status_code >= 400:
            raise UpstreamApiError(
                "BMRCL file request failed.",
                status_code=response.status_code,
            )
        content = response.content
        if len(content) > max_bytes:
            raise UpstreamApiError(
                f"BMRCL file is larger than {max_bytes} bytes.",
                status_code=response.status_code,
            )
        media = response.headers.get("content-type", "application/octet-stream")
        return content, media.split(";")[0].strip() or "application/octet-stream"

    @staticmethod
    def _decode(response: httpx.Response, path: str) -> Any:
        if response.status_code >= 400:
            raise UpstreamApiError(
                f"BMRCL {path} returned HTTP {response.status_code}.",
                status_code=response.status_code,
            )
        try:
            payload = response.json()
        except ValueError as exc:
            raise UpstreamApiError(
                f"BMRCL {path} did not return JSON.",
                status_code=response.status_code,
            ) from exc
        return payload


bmrc_client = BmrcClient()
