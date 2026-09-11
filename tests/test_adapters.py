"""Test Standardized Data Adapters for INFINOVA."""
import pytest
from backend.adapters import (
    AISDataAdapter,
    OceanCurrentAdapter,
    SentinelSatelliteAdapter,
    WindDataAdapter,
)


def validate_normalized_contract(res: dict):
    assert "data" in res, "Missing 'data' key"
    assert "metadata" in res, "Missing 'metadata' key"
    meta = res["metadata"]
    assert "source" in meta
    assert meta["source_type"] in ["LIVE", "NEAR-REAL-TIME", "HISTORICAL", "SIMULATED", "UNAVAILABLE"]
    assert "timestamp" in meta
    assert isinstance(meta["latency_seconds"], (int, float))
    assert isinstance(meta["fallback_used"], bool)
    assert "attribution" in meta


def test_satellite_adapter():
    adapter = SentinelSatelliteAdapter()
    res = adapter.get_scenes()
    validate_normalized_contract(res)
    assert len(res["data"]) > 0
    first = res["data"][0]
    assert "scene_id" in first
    assert "satellite" in first
    assert "instrument" in first
    assert "acquisition_time" in first


def test_wind_adapter():
    adapter = WindDataAdapter()
    res_point = adapter.get_point_wind(19.12, 71.85)
    validate_normalized_contract(res_point)
    assert len(res_point["data"]) == 1
    pt = res_point["data"][0]
    assert "u_wind" in pt
    assert "v_wind" in pt
    assert "wind_speed_ms" in pt
    assert "wind_direction_from" in pt

    res_grid = adapter.get_regional_wind_field(bbox=(70.0, 18.0, 72.0, 20.0), step=1.0)
    validate_normalized_contract(res_grid)
    assert len(res_grid["data"]) > 0


def test_ocean_adapter():
    adapter = OceanCurrentAdapter()
    res_point = adapter.get_point_current(19.12, 71.85)
    validate_normalized_contract(res_point)
    assert len(res_point["data"]) == 1
    pt = res_point["data"][0]
    assert "u_current" in pt
    assert "v_current" in pt
    assert "current_speed_ms" in pt

    res_grid = adapter.get_regional_current_field(bbox=(70.0, 18.0, 72.0, 20.0), step=1.0)
    validate_normalized_contract(res_grid)
    assert len(res_grid["data"]) > 0


def test_ais_adapter():
    adapter = AISDataAdapter()
    res = adapter.get_vessels()
    validate_normalized_contract(res)
    assert len(res["data"]) > 0
    v = res["data"][0]
    assert "mmsi" in v
    assert "latitude" in v or "lat" in v
    assert "longitude" in v or "lon" in v
