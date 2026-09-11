"""Local data-source adapters.

The SIH demo must run offline. Swap these classes later for Sentinel-1, live AIS,
or operational ocean products without changing the investigation pipeline contract.
"""

from __future__ import annotations

from pathlib import Path

from backend.config import AIS_PATH, INCIDENT_PATH, OCEAN_PATH, SAR_PATH
from backend.services.incident import load_incident, resolve_path


class LocalSatelliteSource:
    """Reads a SAR scene from disk (PNG/TIFF)."""

    def path(self, incident: dict | None = None) -> Path:
        incident = incident or load_incident()
        rel = incident.get("sar_image") or incident.get("sar_relative_path")
        p = resolve_path(rel) if rel else SAR_PATH
        return p


class LocalAISSource:
    """Reads historical AIS positions from a local CSV."""

    def path(self, incident: dict | None = None) -> Path:
        incident = incident or load_incident()
        rel = incident.get("ais_file") or incident.get("ais_relative_path")
        p = resolve_path(rel) if rel else AIS_PATH
        return p


class LocalOceanSource:
    """Reads wind/current demonstration time series from a local CSV."""

    def path(self, incident: dict | None = None) -> Path:
        incident = incident or load_incident()
        rel = incident.get("ocean_file") or incident.get("ocean_relative_path")
        p = resolve_path(rel) if rel else OCEAN_PATH
        return p


class LocalIncidentSource:
    def path(self) -> Path:
        return INCIDENT_PATH


# Default demo wiring (offline).
satellite_source = LocalSatelliteSource()
ais_source = LocalAISSource()
ocean_source = LocalOceanSource()
incident_source = LocalIncidentSource()
