"""Tests for INFINOVA Live Mode, INCOIS, and Provider Telemetry."""
from fastapi.testclient import TestClient
from backend.main import app
from backend.providers.registry import registry

client = TestClient(app)


def test_mode_switching():
    # Switch to LIVE
    resp = client.post("/api/health/mode", json={"mode": "live"})
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["mode"] == "LIVE"
    assert registry.get_mode() == "live"

    # Switch to DEMO
    resp = client.post("/api/health/mode", json={"mode": "demo"})
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["mode"] == "DEMO"
    assert registry.get_mode() == "demo"

    # Get current mode
    resp = client.get("/api/health/mode")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["mode"] == "DEMO"


def test_telemetry_endpoint():
    resp = client.get("/api/health/telemetry")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert "sources" in data
    assert len(data["sources"]) >= 4

    sources = {s["id"]: s for s in data["sources"]}
    assert "cdse" in sources
    assert "era5" in sources
    assert "incois" in sources
    assert "ais" in sources

    for s in data["sources"]:
        assert "http_status" in s
        assert "response_time_ms" in s
        assert "record_count" in s
        assert "status" in s
        assert s["status"] in ("LIVE", "CACHED", "HISTORICAL", "SIMULATED", "UNAVAILABLE", "AUTH REQUIRED")
        assert "json_preview" in s


def test_incois_currents_endpoint():
    resp = client.get("/api/environment/currents?provider=incois&resolution=1.0")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["source"] == "INCOIS"
    assert "vectors" in data
    assert len(data["vectors"]) > 0

    first = data["vectors"][0]
    assert "currentSpeed" in first
    assert "currentDirection" in first
    assert "uComponent" in first
    assert "vComponent" in first
    assert "latitude" in first
    assert "longitude" in first
    assert first["status"] in ("LIVE", "CACHED", "UNAVAILABLE", "SIMULATED")


def test_era5_wind_endpoint():
    resp = client.get("/api/environment/wind?resolution=1.0")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert "Copernicus" in data["source"]
    assert "vectors" in data
    assert len(data["vectors"]) > 0

    first = data["vectors"][0]
    assert "windSpeed" in first
    assert "windDirection" in first
    assert "uComponent" in first
    assert "vComponent" in first
    assert "latitude" in first
    assert "longitude" in first
    assert first["status"] in ("LIVE", "HISTORICAL", "SIMULATED")


def test_ais_providers_and_coordinates():
    # Test INCOIS AIS
    resp = client.get("/api/ais/vessels?provider=incois")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert "vessels" in data
    assert len(data["vessels"]) > 0
    for v in data["vessels"]:
        assert "latitude" in v and isinstance(v["latitude"], (int, float))
        assert "longitude" in v and isinstance(v["longitude"], (int, float))
        assert "mmsi" in v
        assert "track" in v
        for pt in v["track"]:
            assert "latitude" in pt and "longitude" in pt
            assert "timestamp" in pt or "time" in pt

    # Test MarineCadastre Historical
    resp = client.get("/api/ais/vessels?provider=marinecadastre")
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert data["source_type"] == "HISTORICAL"
