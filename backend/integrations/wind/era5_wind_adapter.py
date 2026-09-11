"""Wind Data Integration Adapter (ERA5 / Open-Meteo Atmospheric Reanalysis).

Returns normalized wind vectors:
- speed in m/s (internal standard) and km/h (display)
- direction_from (meteorological FROM direction, 0-360°)
- bearing_to (oceanographic TO direction, 0-360°)
- compass format: e.g. "18 km/h SW -> NE"
- u, v components in m/s
- timestamp (ISO-8601 UTC)
- source and data_mode (LIVE / CACHED / HISTORICAL)
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

COMPASS_DIRS = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
]


def deg_to_compass(deg: float) -> str:
    val = int((deg / 22.5) + 0.5)
    return COMPASS_DIRS[val % 16]


def format_wind_display(speed_ms: float, dir_from: float) -> str:
    speed_kmh = round(speed_ms * 3.6, 1)
    dir_to = (dir_from + 180.0) % 360.0
    c_from = deg_to_compass(dir_from)
    c_to = deg_to_compass(dir_to)
    return f"{speed_kmh} km/h {c_from} -> {c_to}"


class WindIntegrationAdapter:
    """Standardized Wind Data Adapter."""

    def __init__(self):
        self.source_name = "Open-Meteo / ERA5 10m Atmospheric Wind"

    def normalize_wind_observation(
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
        # Meteorological FROM direction: angle wind is blowing FROM
        dir_to = float((math.degrees(math.atan2(u_ms, v_ms)) + 360) % 360)
        dir_from = (dir_to + 180.0) % 360.0

        ts = timestamp or datetime.now(timezone.utc).isoformat()
        src = source or self.source_name

        return {
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "timestamp": ts,
            "source": src,
            "data_mode": data_mode,
            "u_wind": round(u_ms, 3),
            "v_wind": round(v_ms, 3),
            "wind_speed": round(speed_ms, 2),  # m/s
            "wind_speed_kmh": round(speed_ms * 3.6, 1),
            "wind_direction": round(dir_from, 1),  # FROM
            "wind_direction_from": round(dir_from, 1),
            "wind_bearing_to": round(dir_to, 1),  # TO
            "display": format_wind_display(speed_ms, dir_from),
            "units": {
                "speed": "m/s",
                "display_speed": "km/h",
                "direction": "degrees (meteorological FROM)",
            },
        }
