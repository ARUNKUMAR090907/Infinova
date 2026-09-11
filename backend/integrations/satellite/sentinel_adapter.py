"""Sentinel-1 Synthetic Aperture Radar (SAR) Satellite Integration Adapter.

Official Source:
    Copernicus Data Space Ecosystem (CDSE) / Sentinel-1 C-band SAR
    Mission: Sentinel-1A / Sentinel-1B IW GRDH

Returns normalized satellite metadata:
- scene_id
- sensor ("C-SAR / Interferometric Wide Swath")
- polarization ("VV + VH")
- pass_direction ("ASCENDING" / "DESCENDING")
- acquisition_time
- georeference bounds
- resolution (10m x 10m ground range pixel spacing)
- source and data_mode (LIVE / CACHED / HISTORICAL)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class SentinelSatelliteAdapter:
    """Standardized Sentinel-1 SAR Metadata Adapter."""

    def __init__(self):
        self.mission = "Copernicus Sentinel-1 SAR"

    def normalize_scene_metadata(
        self,
        scene_id: str,
        acquisition_time: str,
        georef: dict,
        data_mode: str = "HISTORICAL",
    ) -> Dict[str, Any]:
        return {
            "scene_id": scene_id,
            "mission": self.mission,
            "instrument": "C-band Synthetic Aperture Radar (C-SAR)",
            "mode": "Interferometric Wide (IW)",
            "product_type": "GRDH (Ground Range Detected High Resolution)",
            "polarization": "VV (Co-polarization for slick dampening contrast)",
            "pixel_spacing_meters": 10.0,
            "acquisition_time_utc": acquisition_time,
            "georeference": georef,
            "data_mode": data_mode,
            "source": "ESA Copernicus Open Access Hub / CDSE",
        }
