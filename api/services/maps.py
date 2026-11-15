"""The two map images the English site links by a stable path."""

from schemas.news import MapAsset

SITE = "https://english.bmrc.co.in"

MAPS: dict[str, MapAsset] = {
    "phase": MapAsset(
        family="phase",
        title="Phase map",
        content_type="image/jpeg",
        source_url=f"{SITE}/images/PHASE-1-2-2A-2B.jpg",
    ),
    "schematic": MapAsset(
        family="schematic",
        title="Kannada schematic",
        content_type="image/jpeg",
        source_url=f"{SITE}/images/metro/travel-info/sitemapimgkan.jpg",
    ),
}
