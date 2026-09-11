from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.schemas import DriftRequest, ForecastRequest
from backend.services.envelope import with_envelope
from backend.services.forecast import run_forecast
from backend.services.hindcast import run_hindcast

router = APIRouter()


@router.post("/hindcast")
def hindcast(req: DriftRequest):
    try:
        return with_envelope(
            run_hindcast(
            centroid=req.centroid,
            observation_time=req.observation_time,
            ocean_path=req.ocean_path,
            hours_back=req.hours_back,
            step_hours=req.step_hours,
            estimated_age_hours=req.estimated_age_hours,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/forecast")
def forecast(req: ForecastRequest):
    try:
        return with_envelope(
            run_forecast(
            centroid=req.centroid,
            observation_time=req.observation_time,
            ocean_path=req.ocean_path,
            horizons_hours=req.horizons_hours,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
