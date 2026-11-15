"""Runtime settings. The BMRC key is the public site token, not a user secret."""

from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    app_name: str = Field(default="Namma Metro API")
    app_version: str = Field(default="0.1.0")
    app_description: str = Field(
        default=(
            "Lines, stations, and journey fares for Namma Metro. "
            "Station lists and prices come from the public BMRCL site. "
            "The route between two stations is computed here."
        )
    )
    debug: bool = Field(default=False)

    bmrc_base_url: AnyHttpUrl = Field(
        default="https://english.bmrc.co.in:8282/api",
    )
    bmrc_api_key: str = Field(
        default="7a3ac55ef3482d34682eb75d52b44f44",
        description="Bearer token shipped in the public english.bmrc.co.in bundle.",
    )
    bmrc_origin: str = Field(default="https://english.bmrc.co.in")
    bmrc_timeout_seconds: float = Field(default=15.0, ge=1.0, le=60.0)
    bmrc_catalog_ttl_seconds: float = Field(default=900.0, ge=0.0)
    bmrc_fare_ttl_seconds: float = Field(default=900.0, ge=0.0)
    bmrc_snapshot_path: Path = Field(
        default=API_ROOT / "data" / "stations.snapshot.json",
    )
    bmrc_interchanges_path: Path = Field(
        default=API_ROOT / "data" / "interchanges.json",
    )
    map_download_max_bytes: int = Field(default=25 * 1024 * 1024, ge=1024)
    bmrc_live: bool = Field(
        default=False,
        description="When true, the live fare test calls BMRCL.",
    )

    model_config = SettingsConfigDict(
        env_prefix="BMRC_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
