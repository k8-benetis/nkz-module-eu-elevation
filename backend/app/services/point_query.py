"""Point elevation query — resolves best DEM source by bbox and samples elevation via WCS."""
import logging
from app.dem_sources import DEM_SOURCES, DEMSource

logger = logging.getLogger(__name__)


def resolve_source(lat: float, lon: float) -> DEMSource | None:
    """Find the first DEM source whose bbox contains the query point."""
    for src in DEM_SOURCES:
        west, south, east, north = src.bbox
        if west <= lon <= east and south <= lat <= north:
            return src
    return None


def build_wcs_url(source: DEMSource, lat: float, lon: float) -> tuple[str, dict, dict]:
    """Build WCS GetCoverage URL, params, and headers for a point query."""
    try:
        res_m = float(source.resolution.replace("m", ""))
    except (ValueError, AttributeError):
        res_m = 25.0

    half = res_m / 111320.0 / 2.0

    params = {
        "SERVICE": "WCS",
        "VERSION": "2.0.1",
        "REQUEST": "GetCoverage",
        "COVERAGEID": source.layer_name or "elevation",
        "FORMAT": "image/tiff",
        "SUBSETLON": f"Long({lon - half},{lon + half})",
        "SUBSETLAT": f"Lat({lat - half},{lat + half})",
    }

    headers = {"Accept": "image/tiff"}
    return source.service_url, params, headers
