"""Point elevation query — resolves best DEM source by bbox and samples elevation via WCS."""
import logging
from app.dem_sources import DEM_SOURCES, DEMSource

logger = logging.getLogger(__name__)

# Known-good WCS 1.0.0 parameters per country
WCS_PARAMS: dict[str, dict] = {
    # ── WCS 1.0.0 endpoints ──────────────────────────
    "ES": {
        "VERSION": "1.0.0",
        "FORMAT": "GEOTIFFINT16",
        "CRS": "EPSG:4326",
        "COVERAGE_PARAM": "COVERAGE",
        "BBOX_ORDER": "lonlat",  # lon,lat in BBOX
    },
    "NL": {
        "VERSION": "1.0.0",
        "FORMAT": "GEOTIFFINT16",
        "CRS": "EPSG:4326",
        "COVERAGE_PARAM": "COVERAGE",
    },
    "PL": {
        "VERSION": "1.0.0",
        "FORMAT": "GEOTIFFINT16",
        "CRS": "EPSG:4326",
        "COVERAGE_PARAM": "COVERAGE",
    },
    # ── WCS 2.0.1 endpoints (explicit; defaults also work) ──
    "DE": {"VERSION": "2.0.1"},
    "AT": {"VERSION": "2.0.1"},
    "CZ": {"VERSION": "2.0.1"},
    "GB": {"VERSION": "2.0.1"},
    "DK": {"VERSION": "2.0.1"},
    "FI": {"VERSION": "2.0.1"},
    "NO": {"VERSION": "2.0.1"},
    "IT": {"VERSION": "2.0.1"},
}


def resolve_source(lat: float, lon: float) -> DEMSource | None:
    """Find the first DEM source whose bbox contains the query point.

    Only primary (non-fallback) national WCS endpoints are considered.
    Sources marked fallback=True (pan-European Copernicus, known outages
    like PT since 2026-06-05) are skipped — they are not WCS-queryable.
    """
    for src in DEM_SOURCES:
        if src.fallback:
            continue
        west, south, east, north = src.bbox
        if west <= lon <= east and south <= lat <= north:
            return src
    return None


def build_wcs_url(source: DEMSource, lat: float, lon: float) -> str:
    """Build a WCS GetCoverage URL for a single-pixel query.

    Uses WCS 1.0.0 for known-compatible sources (ES), WCS 2.0.1 otherwise.
    Returns the full URL string.
    """
    params = WCS_PARAMS.get(source.country_code, {})
    version = params.get("VERSION", "2.0.1")

    if version == "1.0.0":
        return _build_wcs_1_0(source, lat, lon, params)
    else:
        return _build_wcs_2_0(source, lat, lon, params)


def _build_wcs_1_0(source: DEMSource, lat: float, lon: float, params: dict) -> str:
    """WCS 1.0.0 GetCoverage: simple BBOX + CRS + FORMAT."""
    fmt = params.get("FORMAT", source.format)
    crs = params.get("CRS", "EPSG:4326")
    coverage_param = params.get("COVERAGE_PARAM", "COVERAGE")
    coverage = source.layer_name or "elevation"
    try:
        res_m = float(source.resolution.replace("m", ""))
    except (ValueError, AttributeError):
        res_m = 500.0
    half = res_m / 111320.0 / 2.0  # degrees for half a pixel
    bbox = f"{lon - half},{lat - half},{lon + half},{lat + half}"

    url = (
        f"{source.service_url}?"
        f"SERVICE=WCS&"
        f"VERSION=1.0.0&"
        f"REQUEST=GetCoverage&"
        f"{coverage_param}={coverage}&"
        f"FORMAT={fmt}&"
        f"BBOX={bbox}&"
        f"CRS={crs}&"
        f"WIDTH=1&"
        f"HEIGHT=1"
    )
    return url


def _build_wcs_2_0(source: DEMSource, lat: float, lon: float, params: dict) -> str:
    """WCS 2.0.1 GetCoverage: SUBSET syntax."""
    try:
        res_m = float(source.resolution.replace("m", ""))
    except (ValueError, AttributeError):
        res_m = 25.0
    half = res_m / 111320.0 / 2.0

    coverage = source.layer_name or "elevation"
    url = (
        f"{source.service_url}?"
        f"SERVICE=WCS&"
        f"VERSION=2.0.1&"
        f"REQUEST=GetCoverage&"
        f"COVERAGEID={coverage}&"
        f"FORMAT=image/tiff&"
        f"SUBSET=Long({lon - half},{lon + half})&"
        f"SUBSET=Lat({lat - half},{lat + half})"
    )
    return url
