from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class LatLng(BaseModel):
    lat: float
    lng: float


class DetectionRequest(BaseModel):
    image_id: Optional[str] = None
    image_path: Optional[str] = None
    incident_id: Optional[str] = None


class CharacterizeRequest(BaseModel):
    mask_path: Optional[str] = None
    image_id: Optional[str] = None
    incident_id: Optional[str] = None
    pixel_size_m: Optional[float] = None
    bounds: Optional[list[float]] = None


class DriftRequest(BaseModel):
    centroid: Optional[LatLng] = None
    incident_id: Optional[str] = None
    hours_back: float = 12
    time_step_hours: float = 1


class ForecastRequest(BaseModel):
    centroid: Optional[LatLng] = None
    incident_id: Optional[str] = None
    horizons_hours: list[float] = Field(default_factory=lambda: [1, 2, 3, 6, 12])


class AISAnalyzeRequest(BaseModel):
    ais_path: Optional[str] = None
    incident_id: Optional[str] = None
    origin: Optional[LatLng] = None
    origin_time_iso: Optional[str] = None
    spatial_radius_km: float = 40
    temporal_window_hours: float = 8


class AttributeRequest(BaseModel):
    incident_id: Optional[str] = None
    candidates: Optional[list[dict[str, Any]]] = None
    origin: Optional[LatLng] = None
    origin_time_iso: Optional[str] = None


class InvestigationRequest(BaseModel):
    incident_id: Optional[str] = "DEMO-MG-001"
    image_id: Optional[str] = None
    ais_path: Optional[str] = None


class ReportRequest(BaseModel):
    incident_id: Optional[str] = "DEMO-MG-001"
    payload: Optional[dict[str, Any]] = None
