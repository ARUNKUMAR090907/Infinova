from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    demo_mode: bool = True
    data_provenance: str = "SYNTHETIC DEMONSTRATION DATA"
    success: bool = True
    ml_weights_present: bool = False
    detection_mode: str = "Prototype / Demo"


class DetectRequest(BaseModel):
    image_path: Optional[str] = None
    threshold: float = 0.45


class CharacterizeRequest(BaseModel):
    mask: Optional[list[list[int]]] = None
    georef: Optional[dict[str, Any]] = None
    image_path: Optional[str] = None
    threshold: float = 0.45


class DriftRequest(BaseModel):
    centroid: dict[str, Any]
    observation_time: str
    ocean_path: Optional[str] = None
    hours_back: float = 6.0
    step_hours: float = 0.5
    estimated_age_hours: float = 4.5


class ForecastRequest(BaseModel):
    centroid: dict[str, Any]
    observation_time: str
    ocean_path: Optional[str] = None
    horizons_hours: list[float] = Field(default_factory=lambda: [1, 2, 3, 6, 12])


class AISAnalyzeRequest(BaseModel):
    ais_path: Optional[str] = None
    origin: dict[str, Any]
    origin_time: str
    window_hours: float = 3.0
    spatial_km: float = 25.0


class AttributeRequest(BaseModel):
    candidates: list[dict[str, Any]]
    origin: dict[str, Any]
    origin_time: str


class InvestigationRequest(BaseModel):
    incident_path: Optional[str] = None


class ReportRequest(BaseModel):
    investigation: dict[str, Any]
