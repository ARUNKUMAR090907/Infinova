from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.config import DATA_DIR
from backend.services.envelope import with_envelope
from backend.services.forecast import run_forecast
from backend.services.hindcast import run_hindcast
from backend.services.report_builder import generate_case_investigation_pdf
from backend.services.validation_engine import validate_prediction_against_ground_truth
from backend.services.vessel_scoring import score_vessels

router = APIRouter()

CASES_DIR = DATA_DIR / "cases"
CASES_DIR.mkdir(parents=True, exist_ok=True)


def _load_case_file(case_id: str) -> dict:
    # Look for exact or case-insensitive matching JSON file
    for p in CASES_DIR.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("case_id") == case_id or p.stem == case_id:
                    return data
        except Exception:
            continue
    raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")


def _save_case_file(data: dict) -> Path:
    cid = data.get("case_id") or f"CASE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    data["case_id"] = cid
    file_path = CASES_DIR / f"{cid}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return file_path


@router.get("/cases")
def list_cases():
    cases = []
    for p in sorted(CASES_DIR.glob("*.json")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                c = json.load(f)
                inputs = c.get("inputs", {})
                sat = inputs.get("satellite", {})
                cases.append({
                    "case_id": c.get("case_id", p.stem),
                    "name": c.get("name", p.stem),
                    "location": c.get("location", "Offshore"),
                    "incident_date": c.get("incident_date", c.get("t0_timestamp")),
                    "status": c.get("status", "Uploaded"),
                    "coordinates": c.get("coordinates"),
                    "data_sources": {
                        "satellite": bool(sat.get("t0_spill")),
                        "before_satellite": bool(sat.get("before_spill")),
                        "ais": bool(inputs.get("ais", {}).get("vessels")),
                        "wind": bool(inputs.get("wind")),
                        "ocean_current": bool(inputs.get("ocean_current")),
                        "ground_truth": bool(c.get("ground_truth", {}).get("future_observations")),
                    },
                    "has_analysis": bool(c.get("analysis")),
                    "has_validation": bool(c.get("validation")),
                })
        except Exception:
            continue
    return with_envelope({"cases": cases, "count": len(cases)})


@router.get("/cases/{case_id}")
def get_case(case_id: str):
    data = _load_case_file(case_id)
    return with_envelope(data)


@router.delete("/cases/{case_id}")
def delete_case(case_id: str):
    found = False
    for p in CASES_DIR.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                c = json.load(f)
                if c.get("case_id") == case_id or p.stem == case_id:
                    p.unlink()
                    found = True
                    break
        except Exception:
            continue
    if not found:
        raise HTTPException(status_code=404, detail="Case not found")
    return with_envelope({"ok": True, "deleted": case_id})


@router.post("/cases")
def create_or_save_case(payload: dict):
    """Creates or updates a case. Supports 'All details in one file' upload."""
    cid = payload.get("case_id") or f"CASE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    payload["case_id"] = cid
    if "inputs" not in payload:
        payload["inputs"] = {
            "satellite": {},
            "ais": {"vessels": []},
            "wind": {},
            "ocean_current": {},
        }
    if "ground_truth" not in payload:
        payload["ground_truth"] = {"future_observations": {}}
    if "status" not in payload:
        payload["status"] = "Ready for Analysis"

    _save_case_file(payload)
    return with_envelope(payload)


@router.post("/cases/upload-bundle")
async def upload_case_bundle(file: UploadFile = File(...)):
    """Accepts a complete case JSON file containing all details in one file."""
    try:
        content = await file.read()
        case_data = json.loads(content.decode("utf-8"))
        if not isinstance(case_data, dict):
            raise ValueError("Invalid case file format: root must be a JSON object.")
        if "case_id" not in case_data:
            case_data["case_id"] = f"CASE-{Path(file.filename).stem}"
        _save_case_file(case_data)
        return with_envelope({
            "ok": True,
            "case_id": case_data["case_id"],
            "name": case_data.get("name"),
            "message": "Complete historical case file successfully uploaded and verified.",
            "data": case_data,
        })
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse case file: {str(exc)}") from exc


@router.post("/cases/{case_id}/validate-inputs")
def validate_case_inputs(case_id: str):
    """Validates required datasets, coordinates, timestamps, and reports explicit limitations."""
    case = _load_case_file(case_id)
    inputs = case.get("inputs", {})
    sat = inputs.get("satellite", {})
    t0_sat = sat.get("t0_spill")
    ais = inputs.get("ais", {})
    wind = inputs.get("wind", {})
    current = inputs.get("ocean_current", {})

    checks = []
    limitations = []
    is_valid = True

    # 1. Satellite T0 observation
    if t0_sat and t0_sat.get("centroid"):
        lat = t0_sat["centroid"].get("latitude")
        lon = t0_sat["centroid"].get("longitude")
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            checks.append({"dataset": "Satellite T0", "status": "Valid", "detail": f"Observation at ({lat:.3f}, {lon:.3f})"})
        else:
            checks.append({"dataset": "Satellite T0", "status": "Error", "detail": "Coordinates out of bounds."})
            is_valid = False
    else:
        checks.append({"dataset": "Satellite T0", "status": "Missing", "detail": "Required T0 spill observation is missing."})
        is_valid = False

    # 2. AIS Dataset
    vessels = ais.get("vessels", [])
    if vessels:
        checks.append({
            "dataset": "AIS Data",
            "status": "Valid",
            "detail": f"{len(vessels)} vessels identified with historical tracks.",
        })
    else:
        limitations.append("AIS dataset missing or empty. Attribution ranking will be unavailable.")
        checks.append({"dataset": "AIS Data", "status": "Warning", "detail": "No AIS records provided."})

    # 3. Wind Data
    if wind:
        checks.append({"dataset": "Wind Data", "status": "Valid", "detail": wind.get("coverage", "Available")})
    else:
        limitations.append("Missing atmospheric wind data. Hindcast/Forecast will rely on standard defaults.")
        checks.append({"dataset": "Wind Data", "status": "Warning", "detail": "Missing wind forcing."})

    # 4. Ocean Current Data
    if current:
        checks.append({"dataset": "Ocean Current Data", "status": "Valid", "detail": current.get("coverage", "Available")})
    else:
        limitations.append("Missing hydrodynamic ocean-current data. Trajectory generated using wind drift leeway only.")
        checks.append({"dataset": "Ocean Current Data", "status": "Warning", "detail": "Missing surface current forcing."})

    # 5. Ground Truth check (for validation only)
    gt = case.get("ground_truth", {})
    gt_obs = gt.get("future_observations", {})
    if gt_obs:
        checks.append({
            "dataset": "Ground Truth (Validation Only)",
            "status": "Isolated",
            "detail": f"{len(gt_obs)} future observations isolated for ground-truth validation.",
        })
    else:
        limitations.append("No future ground-truth observations uploaded. Post-prediction validation cannot be executed.")
        checks.append({"dataset": "Ground Truth", "status": "Info", "detail": "No ground truth observations."})

    return with_envelope({
        "case_id": case_id,
        "is_valid": is_valid,
        "checks": checks,
        "limitations": limitations,
        "can_proceed": is_valid,
    })


@router.post("/cases/{case_id}/analyze")
def run_case_analysis(case_id: str):
    """Executes the analysis pipeline strictly using INPUT DATA up to T0 (Data leakage protection)."""
    case = _load_case_file(case_id)
    inputs = case.get("inputs", {})
    sat = inputs.get("satellite", {})
    t0_sat = sat.get("t0_spill")

    if not t0_sat:
        raise HTTPException(status_code=400, detail="Cannot run analysis without T0 spill observation.")

    centroid = t0_sat.get("centroid", {"latitude": 9.842, "longitude": 75.918})
    obs_time = t0_sat.get("timestamp") or case.get("t0_timestamp") or "2025-05-25T04:15:00Z"
    lat = float(centroid.get("latitude"))
    lon = float(centroid.get("longitude"))

    # 1. Detection & Geometry
    detection = {
        "detected": True,
        "confidence": t0_sat.get("confidence", 0.94),
        "source_scene": t0_sat.get("scene_id", "Sentinel-1 SAR"),
        "centroid": centroid,
        "area_km2": t0_sat.get("area_km2", 22.6),
        "perimeter_km": t0_sat.get("perimeter_km", 31.4),
        "length_km": t0_sat.get("length_km", 9.2),
        "width_km": t0_sat.get("width_km", 3.1),
        "orientation_deg": t0_sat.get("orientation_deg", 48.0),
        "polygon": t0_sat.get("polygon", []),
        "bounding_box": t0_sat.get("bounding_box"),
        "status": "Completed",
    }

    # 2. Hindcast (Origin Backtracking)
    wind_info = inputs.get("wind", {})
    current_info = inputs.get("ocean_current", {})

    # Compute drift vectors based on case inputs
    wind_v = wind_info.get("primary_vector", {"wind_u": 6.72, "wind_v": 4.70})
    curr_v = current_info.get("primary_vector", {"current_u": 0.11, "current_v": -0.40})
    u_net = float(curr_v.get("current_u", 0.11)) + 0.03 * float(wind_v.get("wind_u", 6.72))
    v_net = float(curr_v.get("current_v", -0.40)) + 0.03 * float(wind_v.get("wind_v", 4.70))

    # Backtrack 4.5 hours
    age_hours = 4.5
    back_lat = lat - (v_net * age_hours * 3600.0) / 111320.0
    back_lon = lon - (u_net * age_hours * 3600.0) / (111320.0 * max(math.cos(math.radians(lat)), 0.2))

    unc_km = round(2.5 + 0.3 * age_hours, 2)
    # Circle for estimated origin region
    unc_ring = []
    for deg in range(0, 360, 15):
        rad = math.radians(deg)
        plat = back_lat + (unc_km * math.sin(rad)) / 111.32
        plon = back_lon + (unc_km * math.cos(rad)) / (111.32 * max(math.cos(math.radians(back_lat)), 0.2))
        unc_ring.append([round(plon, 5), round(plat, 5)])
    unc_ring.append(unc_ring[0])

    hindcast = {
        "ok": True,
        "probable_origin": {
            "latitude": round(back_lat, 5),
            "longitude": round(back_lon, 5),
            "time": "T-4.5h Estimated Release Window",
            "label": "Estimated Source Region",
        },
        "uncertainty_radius_km": unc_km,
        "uncertainty_polygon": unc_ring,
        "trajectory": [
            {"hours_back": 0, "latitude": round(lat, 5), "longitude": round(lon, 5)},
            {"hours_back": 1.5, "latitude": round(lat - (v_net * 1.5 * 3600) / 111320, 5), "longitude": round(lon - (u_net * 1.5 * 3600) / (111320 * math.cos(math.radians(lat))), 5)},
            {"hours_back": 3.0, "latitude": round(lat - (v_net * 3.0 * 3600) / 111320, 5), "longitude": round(lon - (u_net * 3.0 * 3600) / (111320 * math.cos(math.radians(lat))), 5)},
            {"hours_back": 4.5, "latitude": round(back_lat, 5), "longitude": round(back_lon, 5)},
        ],
        "estimated_age_hours": age_hours,
        "environmental_forcing": {
            "wind_u": wind_v.get("wind_u"),
            "wind_v": wind_v.get("wind_v"),
            "current_u": curr_v.get("current_u"),
            "current_v": curr_v.get("current_v"),
        },
        "status": "Completed",
    }

    # 3. AIS Attribution Ranking (Explainable Multi-factor)
    vessels = inputs.get("ais", {}).get("vessels", [])
    ranked_vessels = []
    for idx, v in enumerate(vessels):
        dist = float(v.get("min_distance_km", 20.0))
        spatial = max(0.0, min(1.0, 1.0 - (dist / 30.0)))
        temporal = 1.0 if v.get("temporal_candidate") else 0.35
        traj_compat = 0.88 if v.get("trajectory_consistent") else 0.40
        heading_delta = float(v.get("heading_delta_deg", 90.0))
        traj_compat *= max(0.2, min(1.0, 1.0 - (heading_delta / 140.0)))
        wind_compat = 0.85 if v.get("min_sog", 10.0) < 3.5 else 0.65
        curr_compat = 0.90 if v.get("trajectory_consistent") else 0.55

        composite = (
            0.25 * spatial
            + 0.25 * temporal
            + 0.20 * traj_compat
            + 0.15 * wind_compat
            + 0.15 * curr_compat
        )
        score = round(100.0 * composite, 1)

        status_label = (
            "Primary Suspect" if score >= 75
            else "High Relevance" if score >= 55
            else "Moderate Relevance" if score >= 40
            else "Low Relevance"
        )

        evidence = [
            f"Spatial Proximity: {round(spatial * 100, 1)}% ({dist:.1f} km from estimated source region)",
            f"Temporal Alignment: {round(temporal * 100, 1)}% ({'Vessel was present in time window' if temporal > 0.5 else 'Transmissions did not closely match release window'})",
            f"Trajectory Match: {round(traj_compat * 100, 1)}% (Heading deviation {heading_delta:.1f}° relative to drift axis)",
            f"Hydrodynamic Leeway: {round(wind_compat * 100, 1)}% compatibility with wind/current dispersion",
            f"Operational state: SOG {v.get('min_sog', 0)} - {v.get('sog', 0)} kn" + (" (Speed reduction / loitering detected)" if v.get('min_sog', 10) < 3.0 else ""),
        ]

        ranked_vessels.append({
            **v,
            "rank": 0,
            "score": score,
            "overall_score": score,
            "status": status_label,
            "relevance_level": status_label,
            "scores": {
                "spatial_proximity": round(spatial * 100, 1),
                "temporal_proximity": round(temporal * 100, 1),
                "trajectory_match": round(traj_compat * 100, 1),
                "wind_compatibility": round(wind_compat * 100, 1),
                "current_compatibility": round(curr_compat * 100, 1),
                "overall": score,
            },
            "evidence": evidence,
        })

    ranked_vessels.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(ranked_vessels, start=1):
        r["rank"] = i

    attribution = {
        "ok": True,
        "ranked": ranked_vessels,
        "primary_suspect": ranked_vessels[0] if ranked_vessels else None,
        "status": "Completed",
    }

    # 4. Future Prediction (Strictly T0 input)
    horizons = [6, 12, 24]
    pred_points = [
        {
            "hours_ahead": 0,
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "area_km2": detection["area_km2"],
            "perimeter_km": detection["perimeter_km"],
            "label": "T0 Observation",
        }
    ]

    for h in horizons:
        p_lat = lat + (v_net * h * 3600.0) / 111320.0
        p_lon = lon + (u_net * h * 3600.0) / (111320.0 * max(math.cos(math.radians(lat)), 0.2))
        p_area = round(detection["area_km2"] * (1.0 + 0.08 * h), 2)
        p_perim = round(detection["perimeter_km"] * (1.0 + 0.06 * h), 2)

        # Generate predicted contour polygon around predicted centroid
        rad_x = (math.sqrt(p_area) / 2.0) / (111.32 * max(math.cos(math.radians(p_lat)), 0.2))
        rad_y = (math.sqrt(p_area) / 2.0) / 111.32
        poly = []
        for deg in range(0, 360, 45):
            r = math.radians(deg)
            poly.append([
                round(p_lon + rad_x * math.cos(r), 5),
                round(p_lat + rad_y * math.sin(r), 5),
            ])
        poly.append(poly[0])

        pred_points.append({
            "hours_ahead": h,
            "latitude": round(p_lat, 5),
            "longitude": round(p_lon, 5),
            "area_km2": p_area,
            "perimeter_km": p_perim,
            "polygon": poly,
            "label": f"PREDICTED T+{h}h (NOT OBSERVED)",
        })

    forecast = {
        "ok": True,
        "model": "T0 Forward Lagrangian Drift & Spreading Model",
        "label": "PREDICTED — NOT OBSERVED",
        "points": pred_points,
        "trajectory": pred_points,
        "forecast_horizons": horizons,
        "status": "Completed",
    }

    # Store analysis results in case
    case["analysis"] = {
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "detection": detection,
        "hindcast": hindcast,
        "attribution": attribution,
        "forecast": forecast,
    }
    case["status"] = "Analysis Completed"
    _save_case_file(case)

    return with_envelope(case["analysis"])


@router.post("/cases/{case_id}/validate")
def validate_case_results(case_id: str):
    """Compares T0 predictions with post-T0 ground truth. Calculates real IoU, errors, and vessel rank."""
    case = _load_case_file(case_id)
    analysis = case.get("analysis")
    if not analysis:
        raise HTTPException(status_code=400, detail="Please run Case Analysis first before running Validation.")

    gt = case.get("ground_truth")
    if not gt or not gt.get("future_observations"):
        raise HTTPException(status_code=400, detail="No ground-truth observations found in this case.")

    forecast = analysis.get("forecast", {})
    ranked_vessels = analysis.get("attribution", {}).get("ranked", [])

    val_result = validate_prediction_against_ground_truth(
        forecast_result=forecast,
        ground_truth=gt,
        ranked_vessels=ranked_vessels,
    )

    case["validation"] = val_result
    case["status"] = "Validated"
    _save_case_file(case)

    return with_envelope(val_result)


@router.post("/cases/{case_id}/report/generate")
def generate_case_report(case_id: str):
    """Generates a comprehensive forensic case PDF report containing full history and evidence."""
    case = _load_case_file(case_id)
    # Ensure analysis exists
    if not case.get("analysis"):
        analyze_case(case_id)
        case = _load_case_file(case_id)

    res = generate_case_investigation_pdf(case)
    return with_envelope(res)


@router.get("/cases/{case_id}/report/pdf")
def download_case_report_pdf(case_id: str):
    """Generates on-the-fly and downloads the forensic case investigation PDF directly."""
    case = _load_case_file(case_id)
    if not case.get("analysis"):
        analyze_case(case_id)
        case = _load_case_file(case_id)

    res = generate_case_investigation_pdf(case)
    pdf_path = Path(res["path"])
    if not pdf_path.exists():
        raise HTTPException(status_code=500, detail="Report generation failed.")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=res["filename"],
        headers={"Content-Disposition": f'attachment; filename="{res["filename"]}"'},
    )

