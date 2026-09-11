from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd

from backend.services.errors import OceanEyeError
from backend.services.paths import DATA_DIR, DEFAULT_INCIDENT_ID, PROJECT_ROOT


def resolve_path(relative_or_absolute: str) -> Path:
    path = Path(relative_or_absolute)
    if path.is_absolute():
        return path
    return PROJECT_ROOT / path


@lru_cache(maxsize=8)
def load_incident(incident_id: str | None = None) -> dict:
    incident_id = incident_id or DEFAULT_INCIDENT_ID
    path = DATA_DIR / "incident.json"
    if not path.exists():
        raise OceanEyeError(
            "missing_incident",
            "Incident configuration was not found.",
            str(path),
        )
    with path.open("r", encoding="utf-8") as handle:
        incident = json.load(handle)
    if incident.get("incident_id") != incident_id and incident_id != DEFAULT_INCIDENT_ID:
        raise OceanEyeError(
            "unknown_incident",
            f"Unknown incident ID: {incident_id}. This prototype ships one demo incident.",
        )
    return incident


def load_ocean(incident: dict | None = None) -> pd.DataFrame:
    incident = incident or load_incident()
    rel = incident.get("ocean_file") or incident.get("ocean_relative_path")
    if not rel:
        raise OceanEyeError("missing_ocean_data", "Incident has no ocean file path.")
    path = resolve_path(rel)
    if not path.exists():
        raise OceanEyeError("missing_ocean_data", "Oceanographic file is missing.", str(path))
    df = pd.read_csv(path)
    required = {"timestamp", "latitude", "longitude", "wind_u", "wind_v", "current_u", "current_v"}
    missing = required - set(df.columns)
    if missing:
        raise OceanEyeError(
            "missing_ocean_data",
            "Oceanographic file is missing required columns.",
            ", ".join(sorted(missing)),
        )
    if df.empty:
        raise OceanEyeError("missing_ocean_data", "Oceanographic file contains no rows.")
    return df


def ocean_vectors(incident: dict | None = None) -> dict:
    df = load_ocean(incident)
    row = df.iloc[0]
    return {
        "wind_u": float(row["wind_u"]),
        "wind_v": float(row["wind_v"]),
        "current_u": float(row["current_u"]),
        "current_v": float(row["current_v"]),
        "timestamp": str(row["timestamp"]),
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "provenance": "SYNTHETIC DEMONSTRATION DATA",
    }
