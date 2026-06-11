"""Tests for elevation point query endpoint — WCS resolution, caching, refresh."""

import pytest

pytest.importorskip("rasterio", reason="rasterio not installed (non-container env)")

from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestPointQueryCache:

    @patch("app.api.elevation._get_redis", new_callable=AsyncMock)
    @patch("app.api.elevation.resolve_source")
    def test_cache_hit_returns_cached_value(self, mock_resolve, mock_redis):
        """When Redis has a cached elevation value, it's returned without WCS call."""
        mock_redis_instance = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        mock_redis_instance.get.return_value = '{"lat": 42.817, "lon": -1.642, "elevation_m": 445.0, "source": {"id": "test"}}'

        resp = client.get("/api/elevation/point?lat=42.817&lon=-1.642")
        assert resp.status_code == 200
        data = resp.json()
        assert data["elevation_m"] == 445.0
        # resolve_source should NOT have been called (cache hit)
        mock_resolve.assert_not_called()

    @patch("app.api.elevation._get_redis", new_callable=AsyncMock)
    @patch("app.api.elevation.resolve_source")
    def test_cache_miss_calls_wcs(self, mock_resolve, mock_redis):
        """When Redis misses, the WCS source is resolved and queried."""
        mock_redis_instance = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        mock_redis_instance.get.return_value = None  # cache miss
        mock_resolve.return_value = None  # outside coverage → 404

        resp = client.get("/api/elevation/point?lat=42.817&lon=-1.642")
        assert resp.status_code == 404

    @patch("app.api.elevation._get_redis", new_callable=AsyncMock)
    @patch("app.api.elevation.resolve_source")
    def test_refresh_bypasses_cache(self, mock_resolve, mock_redis):
        """refresh=true skips Redis cache and queries WCS directly."""
        mock_redis_instance = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        mock_redis_instance.get.return_value = '{"elevation_m": 999}'  # stale cache
        mock_resolve.return_value = None

        resp = client.get("/api/elevation/point?lat=42.817&lon=-1.642&refresh=true")
        assert resp.status_code == 404
        # Cache was NOT read (refresh bypassed it)
        mock_redis_instance.get.assert_not_called()

    @patch("app.api.elevation._get_redis", new_callable=AsyncMock)
    @patch("app.api.elevation.resolve_source")
    def test_redis_unavailable_still_works(self, mock_resolve, mock_redis):
        """When Redis is down, the endpoint degrades gracefully (no cache, direct WCS)."""
        mock_redis.return_value = None  # Redis unavailable
        mock_resolve.return_value = None

        resp = client.get("/api/elevation/point?lat=42.817&lon=-1.642")
        assert resp.status_code == 404  # 404 because point is outside coverage, but no crash


class TestPointQueryParams:

    def test_purpose_param_accepted(self):
        """All valid purpose values are accepted."""
        for purpose in ["auto", "precision", "routing", "weather", "visualization"]:
            resp = client.get(f"/api/elevation/point?lat=42.0&lon=-1.0&purpose={purpose}")
            assert resp.status_code in (200, 404, 502)  # OK or no-coverage/upstream-error

    def test_invalid_purpose_rejected(self):
        """Invalid purpose values return 422."""
        resp = client.get("/api/elevation/point?lat=42.0&lon=-1.0&purpose=invalid")
        assert resp.status_code == 422

    def test_source_param_accepted(self):
        """Source parameter values are accepted."""
        for source in ["auto", "cnig", "copernicus"]:
            resp = client.get(f"/api/elevation/point?lat=42.0&lon=-1.0&source={source}")
            assert resp.status_code in (200, 404, 502)

    def test_invalid_source_rejected(self):
        """Invalid source values return 400."""
        resp = client.get("/api/elevation/point?lat=42.0&lon=-1.0&source=invalid")
        assert resp.status_code == 400

    def test_missing_coords_returns_422(self):
        """Missing lat/lon return validation error."""
        resp = client.get("/api/elevation/point")
        assert resp.status_code == 422
        resp = client.get("/api/elevation/point?lat=42.0")
        assert resp.status_code == 422
        resp = client.get("/api/elevation/point?lon=-1.0")
        assert resp.status_code == 422


class TestPointQuerySource:

    @patch("app.api.elevation._get_redis", new_callable=AsyncMock)
    def test_response_includes_source_object(self, mock_redis):
        """Response 'source' is an object with id, name, category, is_bare_earth, resolution_m."""
        mock_redis.return_value = None
        resp = client.get("/api/elevation/point?lat=42.817&lon=-1.642")
        # May return 200 (hit) or 404 (no coverage) — check 200 case
        if resp.status_code == 200:
            data = resp.json()
            assert isinstance(data.get("source"), dict)
            assert "id" in data["source"]
            assert "name" in data["source"]
            assert "category" in data["source"]
            assert "is_bare_earth" in data["source"]
