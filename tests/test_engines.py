from __future__ import annotations

import pytest
from backend.services.environmental import build_environmental_grid
from backend.services.hindcast import run_hindcast
from backend.services.forecast import run_forecast
from backend.services.vessel_scoring import score_vessels
from backend.services.ai_report import build_structured_investigation_report


def test_environmental_grid():
    grid = build_environmental_grid(
        bbox=(71.5, 18.8, 72.2, 19.45),
        resolution=0.2,
    )
    assert grid["ok"] is True
    assert grid["point_count"] > 0
    p0 = grid["grid"][0]
    assert "wind" in p0
    assert "current" in p0
    assert "combined" in p0
    assert "speed" in p0["combined"]
    assert "direction" in p0["combined"]
    assert "physics_assumptions" in grid


def test_hindcast_engine():
    res = run_hindcast(
        centroid={"latitude": 19.12, "longitude": 71.85},
        observation_time="2026-03-14T06:30:00Z",
        hours_back=12.0,
    )
    assert res["ok"] is True
    assert "probable_origin" in res
    assert "origin_time_window" in res
    assert "geojson" in res
    assert res["geojson"]["type"] == "FeatureCollection"
    assert len(res["trajectory"]) > 0
    assert res["uncertainty_radius_km"] > 0


def test_forecast_engine():
    res = run_forecast(
        centroid={"latitude": 19.12, "longitude": 71.85},
        observation_time="2026-03-14T06:30:00Z",
        horizons_hours=[6, 12, 24, 48],
    )
    assert res["ok"] is True
    assert len(res["points"]) == 5  # 0h + 4 horizons
    assert "geojson" in res
    assert len(res["uncertainty_corridor"]) > 2


def test_vessel_scoring():
    candidates = [
        {
            "mmsi": 419001234,
            "name": "MT Ocean Pioneer",
            "vessel_type": "Crude Oil Tanker",
            "min_distance_km": 2.4,
            "temporal_candidate": True,
            "trajectory_consistent": True,
            "slow_or_stopped": True,
            "min_sog": 0.8,
            "mean_sog": 1.2,
            "heading_delta_deg": 18.5,
            "max_ais_gap_hours": 0.0,
        },
        {
            "mmsi": 211567890,
            "name": "MV Baltic Trader",
            "vessel_type": "Bulk Carrier",
            "min_distance_km": 28.5,
            "temporal_candidate": False,
            "trajectory_consistent": False,
            "slow_or_stopped": False,
            "min_sog": 12.4,
            "mean_sog": 13.1,
            "heading_delta_deg": 84.0,
            "max_ais_gap_hours": 0.0,
        },
    ]
    res = score_vessels(candidates, {"latitude": 19.12, "longitude": 71.85}, "2026-03-14T02:00:00Z")
    assert res["ok"] is True
    ranked = res["ranked"]
    assert len(ranked) == 2
    top = ranked[0]
    assert top["mmsi"] == 419001234
    assert top["priority"] == "HIGH"
    assert "Potential Suspect Vessel" in top["label"]
    assert "Guilty" not in top["label"]
    assert len(top["evidence"]) > 0
    assert len(top["counter_evidence"]) >= 0


def test_structured_ai_report():
    investigation = {
        "incident": {"incident_id": "MG-2026-TEST", "observation_time": "2026-03-14T06:30:00Z"},
        "detection": {"confidence": 0.92, "mode_label": "Demo Detection"},
        "characterization": {"area_km2": 18.4, "centroid": {"latitude": 19.12, "longitude": 71.85}},
        "hindcast": {"probable_origin": {"latitude": 19.08, "longitude": 71.78}},
        "forecast": {"horizons_hours": [6, 12, 24, 48]},
        "ais": {"total_vessels": 12},
        "attribution": {"ranked": [{"mmsi": 419001234, "name": "MT Ocean Pioneer", "score": 88.5, "priority": "HIGH"}]},
    }
    rep = build_structured_investigation_report(investigation)
    assert rep["ok"] is True
    assert len(rep["sections"]) == 16
    assert rep["sections"][0]["title"] == "Executive Summary"
    assert rep["sections"][14]["title"] == "AI Conclusion"
    assert "highest-priority vessel for investigation" in rep["sections"][14]["content"]
    assert "confirmed responsible vessel" not in rep["sections"][14]["content"]
