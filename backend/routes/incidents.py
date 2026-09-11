from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.db.database import get_connection
from backend.services.ai_report import build_structured_investigation_report
from backend.services.envelope import with_envelope
from backend.services.forecast import run_forecast
from backend.services.hindcast import run_hindcast
from backend.services.pipeline import run_investigation
from backend.services.report_builder import generate_pdf

router = APIRouter()


class IncidentCreateRequest(BaseModel):
    incident_id: Optional[str] = None
    title: str = "Offshore Hydrocarbon Discharge Alert"
    latitude: float
    longitude: float
    area_km2: float
    detection_confidence: float
    satellite_scene: str = "Sentinel-1"
    severity: str = "HIGH"
    status: str = "UNDER INVESTIGATION"
    observation_time: Optional[str] = None


class IncidentHindcastRequest(BaseModel):
    hours_back: float = 12.0
    step_hours: float = 0.5
    estimated_age_hours: float = 4.5


class IncidentForecastRequest(BaseModel):
    horizons_hours: List[float] = Field(default_factory=lambda: [6.0, 12.0, 24.0, 48.0])


@router.post("/incidents")
def create_incident(req: IncidentCreateRequest):
    iid = req.incident_id or f"MG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    obs_time = req.observation_time or datetime.now(timezone.utc).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO incidents (
            incident_id, title, status, severity, latitude, longitude, area_km2,
            detection_confidence, satellite_scene, observation_time, created_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        iid,
        req.title,
        req.status,
        req.severity,
        req.latitude,
        req.longitude,
        req.area_km2,
        req.detection_confidence,
        req.satellite_scene,
        obs_time,
        now_iso,
        json.dumps({"source": "alert_system", "satellite": req.satellite_scene}),
    ))
    conn.commit()
    conn.close()

    return with_envelope({
        "incident_id": iid,
        "title": req.title,
        "status": req.status,
        "severity": req.severity,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "area_km2": req.area_km2,
        "detection_confidence": req.detection_confidence,
        "satellite_scene": req.satellite_scene,
        "observation_time": obs_time,
        "created_at": now_iso,
    })


@router.get("/incidents")
@router.get("/spills")
def list_incidents():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    incidents = []
    for r in rows:
        incidents.append({
            "incident_id": r["incident_id"],
            "title": r["title"],
            "status": r["status"],
            "severity": r["severity"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "area_km2": r["area_km2"],
            "detection_confidence": r["detection_confidence"],
            "satellite_scene": r["satellite_scene"],
            "observation_time": r["observation_time"],
            "created_at": r["created_at"],
        })
    return with_envelope({"incidents": incidents, "count": len(incidents)})


@router.get("/incidents/{incident_id}")
@router.get("/spills/{incident_id}")
def get_incident(incident_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    return with_envelope({
        "incident_id": row["incident_id"],
        "title": row["title"],
        "status": row["status"],
        "severity": row["severity"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "area_km2": row["area_km2"],
        "detection_confidence": row["detection_confidence"],
        "satellite_scene": row["satellite_scene"],
        "observation_time": row["observation_time"],
        "created_at": row["created_at"],
    })


@router.post("/spills/{incident_id}/hindcast")
@router.post("/investigations/{incident_id}/backtrack")
def incident_hindcast(incident_id: str, req: IncidentHindcastRequest = IncidentHindcastRequest()):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    lat = row["latitude"] if row else 19.12
    lon = row["longitude"] if row else 71.85
    obs_time = row["observation_time"] if row else "2026-03-14T06:30:00Z"

    hc = run_hindcast(
        centroid={"latitude": lat, "longitude": lon},
        observation_time=obs_time,
        hours_back=req.hours_back,
        step_hours=req.step_hours,
        estimated_age_hours=req.estimated_age_hours,
    )
    return with_envelope(hc)


@router.post("/spills/{incident_id}/forecast")
@router.post("/investigations/{incident_id}/forward-track")
def incident_forecast(incident_id: str, req: IncidentForecastRequest = IncidentForecastRequest()):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    lat = row["latitude"] if row else 19.12
    lon = row["longitude"] if row else 71.85
    obs_time = row["observation_time"] if row else "2026-03-14T06:30:00Z"

    fc = run_forecast(
        centroid={"latitude": lat, "longitude": lon},
        observation_time=obs_time,
        horizons_hours=req.horizons_hours,
    )
    return with_envelope(fc)


@router.get("/incidents/{incident_id}/report")
@router.get("/investigations/{incident_id}/generate-report")
@router.post("/investigations/{incident_id}/generate-report")
def get_incident_report(incident_id: str):
    inv = run_investigation()
    structured = build_structured_investigation_report(inv.get("data", inv))
    pdf_info = generate_pdf(inv.get("data", inv))
    structured["pdf_download_url"] = pdf_info.get("download_url")
    structured["pdf_filename"] = pdf_info.get("filename")
    return with_envelope(structured)
