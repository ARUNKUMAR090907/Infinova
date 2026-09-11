from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = ROOT
DATA_DIR = ROOT / "data"
SAT_DIR = DATA_DIR / "satellite"
AIS_DIR = DATA_DIR / "ais"
OCEAN_DIR = DATA_DIR / "ocean"
REPORTS_DIR = ROOT / "reports"
ML_DIR = ROOT / "ml"
WEIGHTS_PATH = ML_DIR / "weights" / "unet_oilspill.pt"
INCIDENT_PATH = DATA_DIR / "incident.json"
DEFAULT_INCIDENT_ID = "MG-2026-DEMO-001"


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def load_incident(incident_id: str | None = None) -> dict[str, Any]:
    if not INCIDENT_PATH.exists():
        raise AppError("missing_incident", "Sample incident configuration is missing.")
    with INCIDENT_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if incident_id and incident_id not in (data.get("incident_id"), "DEMO-MG-001"):
        if incident_id != data.get("incident_id"):
            raise AppError("unknown_incident", f"Unknown incident_id: {incident_id}")
    return data


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def destination_point(lat: float, lon: float, east_km: float, north_km: float) -> tuple[float, float]:
    dlat = north_km / 111.32
    dlon = east_km / (111.32 * max(0.2, abs(__import__("math").cos(__import__("math").radians(lat)))))
    return lat + dlat, lon + dlon
