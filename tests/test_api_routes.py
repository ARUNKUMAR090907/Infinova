from __future__ import annotations

import pytest
from starlette.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health_routes():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "data_mode" in data

    r_ds = client.get("/api/health/data-sources")
    assert r_ds.status_code == 200
    ds_data = r_ds.json()
    assert "providers" in ds_data


def test_satellite_routes():
    r_scenes = client.get("/api/satellite/scenes")
    assert r_scenes.status_code == 200
    data = r_scenes.json()
    assert "scenes" in data

    r_search = client.post("/api/satellite/search", json={
        "bbox": [71.5, 18.8, 72.2, 19.45],
        "start_datetime": "2026-03-10T00:00:00Z",
        "end_datetime": "2026-03-15T00:00:00Z",
        "max_scenes": 3,
    })
    assert r_search.status_code == 200
    assert len(r_search.json()["scenes"]) <= 3

    r_alert = client.get("/api/satellite/live-alert-status")
    assert r_alert.status_code == 200
    alert_data = r_alert.json()
    assert "status" in alert_data
    assert "detection" in alert_data
    assert "centroid" in alert_data["detection"]


def test_environment_routes():
    r_wind = client.get("/api/environment/wind?min_lon=71.5&min_lat=18.8&max_lon=72.2&max_lat=19.4")
    assert r_wind.status_code == 200
    assert len(r_wind.json()["vectors"]) > 0

    r_currents = client.get("/api/environment/currents?min_lon=71.5&min_lat=18.8&max_lon=72.2&max_lat=19.4")
    assert r_currents.status_code == 200
    assert len(r_currents.json()["vectors"]) > 0

    r_grid = client.get("/api/environment/grid?min_lon=71.5&min_lat=18.8&max_lon=72.2&max_lat=19.4")
    assert r_grid.status_code == 200
    assert r_grid.json()["point_count"] > 0


def test_ais_routes():
    r_vessels = client.get("/api/ais/vessels")
    assert r_vessels.status_code == 200
    vessels = r_vessels.json()["vessels"]
    assert len(vessels) > 0
    mmsi = vessels[0]["mmsi"]

    r_vessel = client.get(f"/api/ais/vessel/{mmsi}")
    assert r_vessel.status_code == 200
    assert r_vessel.json()["mmsi"] == mmsi

    r_track = client.get(f"/api/ais/track/{mmsi}")
    assert r_track.status_code == 200
    assert "track" in r_track.json()


def test_incidents_routes():
    r_list = client.get("/api/incidents")
    assert r_list.status_code == 200
    assert r_list.json()["count"] > 0

    r_hc = client.post("/api/spills/MG-2026-001/hindcast", json={"hours_back": 12.0})
    assert r_hc.status_code == 200
    assert "probable_origin" in r_hc.json()

    r_fc = client.post("/api/spills/MG-2026-001/forecast", json={"horizons_hours": [6, 12, 24, 48]})
    assert r_fc.status_code == 200
    assert len(r_fc.json()["points"]) == 5

    r_rep = client.get("/api/incidents/MG-2026-001/report")
    assert r_rep.status_code == 200
    assert len(r_rep.json()["sections"]) == 16


def test_investigation_and_pdf_generation_pipeline():
    # Run full investigation
    r_inv = client.post("/api/investigation/run", json={"incident_path": "data/incident.json"})
    assert r_inv.status_code == 200
    inv_data = r_inv.json()
    assert inv_data.get("ok") is True or inv_data.get("status") in ("Completed", "Complete", "Attributed")

    # Generate PDF report
    r_pdf = client.post("/api/report/generate", json={"investigation": inv_data})
    assert r_pdf.status_code == 200
    pdf_data = r_pdf.json()
    fname = pdf_data.get("filename")
    assert fname is not None and fname.endswith(".pdf")

    # Download PDF
    r_down = client.get(f"/api/report/download/{fname}")
    assert r_down.status_code == 200
    assert len(r_down.content) > 1000
    assert r_down.headers.get("content-type") == "application/pdf"


def test_providers_sync_live_data_route():
    r_sync = client.post("/api/providers/sync-live-data", json={"bbox": [71.5, 18.8, 72.2, 19.45]})
    assert r_sync.status_code == 200
    data = r_sync.json()
    assert data.get("success") is True
    assert "providers" in data


def test_dashboard_endpoint():
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "satellite" in data
    assert "wind" in data
    assert "ocean" in data
    assert "weather" in data
    assert "environmental_grid" in data
    assert "hindcast" in data
    assert "forecast" in data
    assert "vessels" in data
    assert "investigation" in data
    assert "status_bar" in data
    assert data["status_bar"]["overall_mode"] in ("LIVE", "HYBRID", "DEMO")


def test_standardized_integrations_routes():
    r_wind = client.get("/api/wind")
    assert r_wind.status_code == 200
    assert "speed_ms" in r_wind.json() or "wind_speed" in r_wind.json() or "speed" in r_wind.json() or "u_wind" in r_wind.json()

    r_ocean = client.get("/api/ocean/current")
    assert r_ocean.status_code == 200
    assert "current_speed" in r_ocean.json()

    r_weather = client.get("/api/weather")
    assert r_weather.status_code == 200
    assert "temperature_c" in r_weather.json()

    r_sat = client.get("/api/satellite/latest")
    assert r_sat.status_code == 200
    assert "scene_id" in r_sat.json()


def test_canonical_endpoints():
    # 1. /api/spills
    r_spills = client.get("/api/spills")
    assert r_spills.status_code == 200
    assert "incidents" in r_spills.json()

    # 2. /api/vessels
    r_vessels = client.get("/api/vessels")
    assert r_vessels.status_code == 200
    assert "vessels" in r_vessels.json()

    # 3. /api/vessels/nearby
    r_nearby = client.get("/api/vessels/nearby?lat=19.12&lon=71.85&radius_km=50")
    assert r_nearby.status_code == 200
    assert "candidates" in r_nearby.json()

    # 4. /api/data-status
    r_ds = client.get("/api/data-status")
    assert r_ds.status_code == 200
    assert "providers" in r_ds.json()

    # 5. /api/environment/regional
    r_reg = client.get("/api/environment/regional?min_lon=70&min_lat=18&max_lon=73&max_lat=20&step=1.0")
    assert r_reg.status_code == 200
    assert "wind" in r_reg.json()
    assert "currents" in r_reg.json()

    # 6. /api/investigations/{id}/backtrack
    r_back = client.post("/api/investigations/MG-DEMO-001/backtrack", json={"hours_back": 6.0})
    assert r_back.status_code == 200

    # 7. /api/investigations/{id}/forward-track
    r_fwd = client.post("/api/investigations/MG-DEMO-001/forward-track", json={"horizons_hours": [6.0]})
    assert r_fwd.status_code == 200

    # 8. /api/investigations/{id}/rank-vessels
    r_rank = client.get("/api/investigations/MG-DEMO-001/rank-vessels")
    assert r_rank.status_code == 200
    assert "ranked_vessels" in r_rank.json()



