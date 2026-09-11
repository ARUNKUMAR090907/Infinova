from __future__ import annotations

import pytest
from backend.providers.satellite import DemoSatelliteProvider
from backend.providers.ais import DemoAISProvider
from backend.providers.weather import DemoWeatherProvider
from backend.providers.ocean import DemoOceanCurrentProvider
from backend.providers.registry import registry


def test_demo_satellite_provider():
    sat = DemoSatelliteProvider()
    scenes = sat.search_scenes(
        bbox=(71.5, 18.8, 72.2, 19.45),
        start_datetime="2026-03-10T00:00:00Z",
        end_datetime="2026-03-15T00:00:00Z",
    )
    assert len(scenes) > 0
    s0 = scenes[0]
    assert "scene_id" in s0
    assert s0["platform"].startswith("Sentinel-1")
    assert s0["product_type"] == "GRD"
    assert "geometry" in s0
    assert "acquisition_metadata" in s0
    assert "polarisation" in s0["acquisition_metadata"]

    health = sat.get_health()
    assert health["status"] == "DEMO"


def test_demo_ais_provider():
    ais = DemoAISProvider()
    vessels = ais.get_vessels()
    assert len(vessels) > 0
    v0 = vessels[0]
    assert "mmsi" in v0
    assert "track" in v0
    assert v0["data_mode"] == "DEMO"

    health = ais.get_health()
    assert health["status"] == "DEMO"
    assert health["unique_vessels"] > 0


def test_demo_weather_provider():
    weather = DemoWeatherProvider()
    winds = weather.get_wind(bbox=(71.5, 18.8, 72.2, 19.45), resolution=0.2)
    assert len(winds) > 0
    w0 = winds[0]
    assert "u_wind" in w0
    assert "v_wind" in w0
    assert "wind_speed" in w0
    assert "wind_direction" in w0


def test_demo_ocean_provider():
    ocean = DemoOceanCurrentProvider()
    currents = ocean.get_currents(bbox=(71.5, 18.8, 72.2, 19.45), resolution=0.2)
    assert len(currents) > 0
    c0 = currents[0]
    assert "u_current" in c0
    assert "v_current" in c0
    assert "current_speed" in c0
    assert "current_direction" in c0


def test_provider_registry_health():
    all_health = registry.get_all_health()
    assert "overall_status" in all_health
    assert "data_mode" in all_health
    assert "providers" in all_health
    assert "cdse_sentinel1" in all_health["providers"]
    assert "vesselfinder_ais" in all_health["providers"]
    assert "copernicus_marine" in all_health["providers"]
    assert "era5_wind" in all_health["providers"]
