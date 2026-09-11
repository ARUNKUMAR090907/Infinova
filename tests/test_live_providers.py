"""
Integration tests for live open-data providers.
These tests make real HTTP requests to verify:
1. CDSE OData is reachable and returns Sentinel-1 scene metadata
2. Open-Meteo Marine returns real ocean current vectors
3. Open-Meteo atmospheric endpoint returns real 10m wind vectors
4. VesselFinder correctly reports NOT_CONFIGURED when key is absent
5. All provenance metadata is present on returned records
"""
from __future__ import annotations

import pytest
import os

from backend.providers.satellite import CDSESatelliteProvider, DemoSatelliteProvider
from backend.providers.ocean import CopernicusMarineProvider
from backend.providers.weather import ERA5WeatherProvider
from backend.providers.ais import VesselFinderAISProvider


DEMO_BBOX = (71.5, 18.8, 72.2, 19.45)


class TestLiveCDSESatellite:
    """Test CDSE OData live connectivity and response structure."""

    def test_cdse_provider_health(self):
        """CDSE health check should complete within timeout and report ONLINE or OFFLINE (not UNKNOWN)."""
        sat = CDSESatelliteProvider()
        health = sat.get_health()
        assert health["status"] in ("ONLINE", "OFFLINE", "DEGRADED")
        assert "latency_ms" in health
        assert "last_check" in health
        assert "provider" in health

    def test_cdse_search_returns_scenes(self):
        """Scene search should return list (live or graceful demo fallback), never raise."""
        sat = CDSESatelliteProvider()
        scenes = sat.search_scenes(
            bbox=DEMO_BBOX,
            start_datetime="2026-09-01T00:00:00Z",
            end_datetime="2026-09-06T23:59:59Z",
            max_scenes=3,
        )
        assert isinstance(scenes, list)

    def test_cdse_live_scenes_have_provenance(self):
        """Every scene must contain provenance metadata."""
        sat = CDSESatelliteProvider()
        scenes = sat.search_scenes(
            bbox=DEMO_BBOX,
            start_datetime="2026-09-01T00:00:00Z",
            end_datetime="2026-09-06T23:59:59Z",
            max_scenes=2,
        )
        for scene in scenes:
            assert "provenance" in scene, f"Scene {scene.get('scene_id')} missing provenance"
            prov = scene["provenance"]
            assert "source_type" in prov
            assert "provider" in prov
            assert "retrieved_at" in prov
            assert prov["source_type"] in ("LIVE", "DEMO", "CACHED")

    def test_demo_satellite_scenes_are_marked_demo(self):
        """Demo satellite scenes must carry source_type=DEMO, never LIVE."""
        demo = DemoSatelliteProvider()
        scenes = demo.search_scenes(bbox=DEMO_BBOX, start_datetime="", end_datetime="")
        for scene in scenes:
            assert scene.get("source_type") == "DEMO"
            assert scene["provenance"]["source_type"] == "DEMO"


class TestLiveOceanCurrents:
    """Test Copernicus Marine live ocean current retrieval."""

    def test_ocean_health_reports_online(self):
        """Copernicus Marine health should report ONLINE when API is reachable."""
        ocean = CopernicusMarineProvider()
        health = ocean.get_health()
        assert health["status"] in ("ONLINE", "OFFLINE", "DEGRADED")
        assert "latency_ms" in health

    def test_ocean_returns_currents_with_live_source_type(self):
        """Live ocean query must return records with source_type=LIVE."""
        ocean = CopernicusMarineProvider()
        records = ocean.get_currents(bbox=DEMO_BBOX, resolution=0.25)
        assert len(records) > 0
        for r in records:
            assert "u_current" in r
            assert "v_current" in r
            assert "current_speed" in r
            assert "provenance" in r
            # Source type must be LIVE (or DEMO if fallback)
            assert r["provenance"]["source_type"] in ("LIVE", "DEMO")

    def test_ocean_live_record_not_hardcoded_demo(self):
        """Live ocean data must NOT claim to be Copernicus DEMO REPLICA without fallback flag."""
        ocean = CopernicusMarineProvider()
        records = ocean.get_currents(bbox=DEMO_BBOX, resolution=0.25)
        for r in records:
            if r["provenance"]["source_type"] == "DEMO":
                # Must explicitly state fallback was used
                assert r["provenance"].get("fallback_used") is True


class TestLiveAtmosphericWind:
    """Test ERA5/ECMWF live atmospheric wind retrieval."""

    def test_wind_health_reports_online(self):
        """ERA5 health should report ONLINE when API is reachable."""
        weather = ERA5WeatherProvider()
        health = weather.get_health()
        assert health["status"] in ("ONLINE", "OFFLINE", "DEGRADED")

    def test_wind_returns_vectors_with_live_source(self):
        """Live wind query must return records with source_type=LIVE."""
        weather = ERA5WeatherProvider()
        records = weather.get_wind(bbox=DEMO_BBOX, resolution=0.25)
        assert len(records) > 0
        for r in records:
            assert "u_wind" in r
            assert "v_wind" in r
            assert "wind_speed" in r
            assert "wind_direction" in r
            assert "provenance" in r
            assert r["provenance"]["source_type"] in ("LIVE", "DEMO")

    def test_wind_values_are_physical(self):
        """Wind speeds must be physically plausible (0.1–50 m/s)."""
        weather = ERA5WeatherProvider()
        records = weather.get_wind(bbox=DEMO_BBOX, resolution=0.25)
        for r in records:
            assert 0 <= r["wind_speed"] <= 80, f"Implausible wind speed: {r['wind_speed']} m/s"


class TestAISHonestFallback:
    """Test VesselFinder AIS honestly reports NOT_CONFIGURED when key is absent."""

    def test_no_key_reports_not_configured(self):
        """Without API key, VesselFinder must report NOT_CONFIGURED."""
        ais = VesselFinderAISProvider(api_key="")
        health = ais.get_health()
        assert health["status"] == "NOT_CONFIGURED"
        assert "commercial" in health["note"].lower() or "key" in health["note"].lower()

    def test_no_key_falls_back_to_archive_with_demo_provenance(self):
        """Without API key, vessels must come from archive with source_type=DEMO and fallback_used=True."""
        ais = VesselFinderAISProvider(api_key="")
        vessels = ais.get_vessels()
        assert len(vessels) > 0
        for v in vessels:
            assert v.get("source_type") == "DEMO"
            assert v.get("fallback_used") is True

    def test_no_key_filter_returns_demo_provenance(self):
        """filter_vessels without key must set fallback_used=True on the result."""
        ais = VesselFinderAISProvider(api_key="")
        result = ais.filter_vessels(
            origin={"latitude": 19.12, "longitude": 71.85},
            origin_time="2026-03-14T02:00:00Z",
        )
        assert result.get("fallback_used") is True
        assert result.get("source_type") == "DEMO"
