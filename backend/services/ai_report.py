from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY


def build_structured_investigation_report(investigation: Dict[str, Any]) -> Dict[str, Any]:
    """Builds a verified, 16-section deterministic investigation report from backend data."""
    incident = investigation.get("incident") or {}
    det = investigation.get("detection") or {}
    char = investigation.get("characterization") or {}
    hc = investigation.get("hindcast") or {}
    fc = investigation.get("forecast") or {}
    ais = investigation.get("ais") or {}
    attr = investigation.get("attribution") or {}
    ranked = attr.get("ranked") or []
    top_candidate = ranked[0] if ranked else None

    iid = incident.get("incident_id", "MG-2026-001")
    origin = hc.get("probable_origin") or {}
    centroid = char.get("centroid") or {}

    sections: List[Dict[str, Any]] = [
        {
            "section_number": 1,
            "title": "Executive Summary",
            "content": (
                f"On {incident.get('observation_time', 'N/A')}, INFINOVA detected a potential marine hydrocarbon slick "
                f"measuring approximately {char.get('area_km2', 'N/A')} km² in the {incident.get('location_name', 'coastal area')} "
                f"with a detection confidence of {round(float(det.get('confidence', 0.0)) * 100, 1)}%. "
                f"Hydrodynamic hindcast modeling traces the probable origin region to coordinates ({origin.get('latitude', 'N/A')}°N, {origin.get('longitude', 'N/A')}°E) "
                f"during the temporal window {hc.get('origin_time_window', {}).get('start', 'N/A')} to {hc.get('origin_time_window', {}).get('end', 'N/A')} UTC. "
                + (
                    f"AIS correlation identified {len(ranked)} candidate vessels, with vessel '{top_candidate.get('name')}' (MMSI: {top_candidate.get('mmsi')}) "
                    f"ranked as the highest-priority vessel for investigation (analytical likelihood score: {top_candidate.get('score')}/100)."
                    if top_candidate
                    else "No commercial vessels were matched within the origin corridor."
                )
            ),
        },
        {
            "section_number": 2,
            "title": "Incident Information",
            "data": {
                "incident_id": iid,
                "title": incident.get("title", "Offshore Spill Event"),
                "status": incident.get("status", "UNDER INVESTIGATION"),
                "severity": incident.get("severity", "HIGH"),
                "location_name": incident.get("location_name", "Arabian Sea"),
                "observation_time_utc": incident.get("observation_time"),
                "data_provenance": incident.get("data_provenance", "SYNTHETIC DEMONSTRATION DATA"),
            },
        },
        {
            "section_number": 3,
            "title": "Satellite Evidence",
            "data": {
                "scene_id": det.get("source_scene", "Sentinel-1 SAR"),
                "detection_mode": det.get("mode_label", "Prototype Detection"),
                "confidence": round(float(det.get("confidence", 0.0)) * 100, 1),
                "disclaimer": det.get("disclaimer"),
                "model_weights_available": det.get("model_weights_available", False),
            },
        },
        {
            "section_number": 4,
            "title": "Spill Characteristics",
            "data": {
                "estimated_area_km2": char.get("area_km2"),
                "length_km": char.get("length_km"),
                "width_km": char.get("width_km"),
                "perimeter_km": char.get("perimeter_km"),
                "aspect_ratio": char.get("aspect_ratio"),
                "shape_morphology": char.get("shape_characteristics"),
                "centroid": centroid,
            },
        },
        {
            "section_number": 5,
            "title": "Environmental Conditions",
            "data": {
                "windage_factor_applied": "3.0% leeway",
                "coriolis_deflection": "15° clockwise (Northern Hemisphere)",
                "ambient_drift_speed_ms": hc.get("forcing_at_observation", {}).get("current_u"),
                "forcing_sources": "Copernicus Marine Surface Currents & ERA5 Reanalysis Winds",
            },
        },
        {
            "section_number": 6,
            "title": "Hindcast Analysis",
            "data": {
                "model_type": hc.get("model", "Eulerian Reverse Trajectory Integration"),
                "steps_computed": len(hc.get("trajectory", [])),
                "estimated_age_hours": hc.get("estimated_age_hours", 4.5),
                "wind_contribution": hc.get("wind_contribution"),
                "current_contribution": hc.get("current_contribution"),
            },
        },
        {
            "section_number": 7,
            "title": "Probable Origin",
            "data": {
                "probable_origin_centroid": origin,
                "origin_time_window": hc.get("origin_time_window"),
                "spatial_uncertainty_radius_km": hc.get("uncertainty_radius_km"),
            },
        },
        {
            "section_number": 8,
            "title": "Forward Forecast",
            "data": {
                "forecast_horizons": fc.get("horizons_hours", [6, 12, 24, 48]),
                "predicted_positions": fc.get("points", []),
                "corridor_width_km": fc.get("uncertainty_width_km"),
                "confidence": fc.get("confidence"),
            },
        },
        {
            "section_number": 9,
            "title": "AIS Vessel Analysis",
            "data": {
                "total_vessels_considered": ais.get("total_vessels"),
                "spatial_candidates": ais.get("spatial_candidates"),
                "temporal_candidates": ais.get("temporal_candidates"),
                "final_ranked_candidates": ais.get("final_candidates"),
                "ais_data_source": ais.get("ais_label", "AIS Provider"),
            },
        },
        {
            "section_number": 10,
            "title": "Candidate Vessel Ranking",
            "candidates": [
                {
                    "rank": v.get("rank"),
                    "mmsi": v.get("mmsi"),
                    "name": v.get("name"),
                    "vessel_type": v.get("vessel_type"),
                    "score": v.get("score"),
                    "priority": v.get("priority"),
                    "scores_breakdown": v.get("scores"),
                }
                for v in ranked
            ],
        },
        {
            "section_number": 11,
            "title": "Evidence Breakdown",
            "details": {
                v.get("name", str(v.get("mmsi"))): v.get("evidence", [])
                for v in ranked[:4]
            },
        },
        {
            "section_number": 12,
            "title": "Counter-evidence",
            "details": {
                v.get("name", str(v.get("mmsi"))): v.get("counter_evidence", [])
                for v in ranked[:4]
            },
        },
        {
            "section_number": 13,
            "title": "Data Quality",
            "details": {
                v.get("name", str(v.get("mmsi"))): v.get("data_quality", "Normal")
                for v in ranked[:4]
            },
        },
        {
            "section_number": 14,
            "title": "Uncertainty & Limitations",
            "limitations": [
                "SAR backscatter reductions may occasionally reflect look-alikes such as biogenic films, grease ice, or sheltered wind shadows.",
                "Terrestrial/Satellite AIS coverage may exhibit transmission latency or unrecorded signal blackouts.",
                "Drift simulations assume homogeneous oceanic and atmospheric boundary conditions across the integration corridor.",
                "Calculations prioritize investigation resources and are not direct observations of discharge.",
            ],
        },
        {
            "section_number": 15,
            "title": "AI Conclusion",
            "content": (
                f"Based on spatial proximity ({top_candidate.get('min_distance_km', 'N/A')} km from estimated origin), "
                f"temporal overlap with the origin window, and navigational behavior, vessel '{top_candidate.get('name')}' "
                f"(MMSI {top_candidate.get('mmsi')}, {top_candidate.get('vessel_type')}) is designated as the "
                f"highest-priority vessel for investigation by port state authorities. "
                f"Field inspectors should prioritize bunker delivery receipts, bilge oil record book entries, and physical hull inspection."
                if top_candidate
                else "No high-likelihood candidate vessel identified from current AIS telemetry."
            ),
        },
        {
            "section_number": 16,
            "title": "Disclaimer",
            "content": (
                "INFINOVA provides intelligence and decision support for maritime law enforcement and environmental agencies. "
                "Attribution scores are analytical likelihood estimates, not legal proof of causation or liability. "
                "Final enforcement action requires physical inspection, forensic chemical finger-printing, and human verification."
            ),
        },
    ]

    return {
        "ok": True,
        "incident_id": iid,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sections": sections,
    }
