"""Ocean Current Data Integration Adapter (Copernicus Marine Service / INCOIS OON).

Returns normalized hydrodynamic current vectors:
- current_speed (m/s)
- current_direction (degrees toward which current flows, 0-360°)
- u_current (Eastward component, m/s)
- v_current (Northward component, m/s)
- timestamp (ISO-8601 UTC)
- source and data_mode (LIVE / CACHED / HISTORICAL)
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class OceanCurrentIntegrationAdapter:
    """Standardized Ocean Current Data Adapter."""

    def __init__(self):
        self.source_name = "Copernicus Marine Service (CMEMS) / INCOIS Hydrodynamic Model"

    def normalize_current_observation(
        self,
        lat: float,
        lon: float,
        u_ms: float,
        v_ms: float,
        timestamp: Optional[str] = None,
        source: Optional[str] = None,
        data_mode: str = "LIVE",
    ) -> Dict[str, Any]:
        speed_ms = float(math.hypot(u_ms, v_ms))
        # Current direction: direction TOWARD which water flows
        direction_to = float((math.degrees(math.atan2(u_ms, v_ms)) + 360) % 360)
        ts = timestamp or datetime.now(timezone.utc).isoformat()
        src = source or self.source_name

        return {
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "timestamp": ts,
            "source": src,
            "data_mode": data_mode,
            "u_current": round(u_ms, 4),
            "v_current": round(v_ms, 4),
            "current_speed": round(speed_ms, 3),  # m/s
            "current_direction": round(direction_to, 1),  # TOWARD
            "display": f"{speed_ms:.2f} m/s @ {direction_to:.0f}°",
            "units": {
                "speed": "m/s",
                "direction": "degrees (oceanographic TO direction)",
                "components": "m/s (u: Eastward, v: Northward)",
            },
        }
