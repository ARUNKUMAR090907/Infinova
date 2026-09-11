from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.providers.registry import registry

# Physical constants for oil drift modeling
DEFAULT_WINDAGE_FACTOR = 0.03  # Standard 3.0% wind leeway factor
DEFAULT_CORIOLIS_DEFLECTION_DEG = 15.0  # ~15° right of wind in Northern Hemisphere


def rotate_vector(u: float, v: float, angle_deg: float) -> Tuple[float, float]:
    """Rotates 2D vector (u: East, v: North) clockwise by angle_deg."""
    rad = math.radians(angle_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    # Clockwise rotation: u' = u*cos + v*sin, v' = -u*sin + v*cos
    u_rot = u * cos_a + v * sin_a
    v_rot = -u * sin_a + v * cos_a
    return u_rot, v_rot


def build_environmental_grid(
    bbox: Tuple[float, float, float, float],
    timestamp: Optional[str] = None,
    resolution: float = 0.15,
    windage_factor: float = DEFAULT_WINDAGE_FACTOR,
    coriolis_deflection: float = DEFAULT_CORIOLIS_DEFLECTION_DEG,
) -> Dict[str, Any]:
    """Generates a unified environmental vector field combining ERA5 wind and Copernicus Marine surface currents.
    
    Physical Assumptions:
    1. Surface ocean currents (uo, vo) transport oil slicks at 100% of current velocity.
    2. 10m atmospheric wind produces surface leeway drift at approximately 3.0% of wind speed (windage factor).
    3. In the Northern Hemisphere (e.g. Arabian Sea), Coriolis force deflects wind leeway drift ~10°-20° to the right of the wind.
    4. Combined drift velocity: v_drift = v_current + alpha * R(theta) * v_wind.
    5. Wind and current vectors are maintained separately for physical explainability and visualization.
    """
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    winds = registry.weather.get_wind(bbox, ts, resolution)
    currents = registry.ocean.get_currents(bbox, ts, depth=0.0, resolution=resolution)

    # Index by rounded lat/lon for spatial alignment
    current_map = {
        (round(c["latitude"], 3), round(c["longitude"], 3)): c
        for c in currents
    }

    grid_points: List[Dict[str, Any]] = []

    for w in winds:
        key = (round(w["latitude"], 3), round(w["longitude"], 3))
        # Find matching or nearest current point
        c = current_map.get(key)
        if not c and current_map:
            # Nearest neighbor fallback
            nearest_key = min(
                current_map.keys(),
                key=lambda k: (k[0] - key[0]) ** 2 + (k[1] - key[1]) ** 2,
            )
            c = current_map[nearest_key]

        uw = float(w["u_wind"])
        vw = float(w["v_wind"])
        uc = float(c["u_current"]) if c else 0.0
        vc = float(c["v_current"]) if c else 0.0

        # Apply windage and Coriolis deflection to wind vector
        u_leeway, v_leeway = rotate_vector(uw * windage_factor, vw * windage_factor, coriolis_deflection)

        # Combined drift vector
        u_combined = uc + u_leeway
        v_combined = vc + v_leeway
        combined_speed = float(math.hypot(u_combined, v_combined))
        combined_direction = float((math.degrees(math.atan2(u_combined, v_combined)) + 360) % 360)

        grid_points.append({
            "latitude": w["latitude"],
            "longitude": w["longitude"],
            "timestamp": ts,
            "wind": {
                "u": uw,
                "v": vw,
                "speed": w["wind_speed"],
                "direction_from": w["wind_direction"],
                "bearing_to": w.get("wind_bearing_to", (w["wind_direction"] + 180) % 360),
            },
            "current": {
                "u": uc,
                "v": vc,
                "speed": c.get("current_speed", float(math.hypot(uc, vc))) if c else 0.0,
                "direction": c.get("current_direction", float((math.degrees(math.atan2(uc, vc)) + 360) % 360)) if c else 0.0,
            },
            "combined": {
                "u": round(u_combined, 4),
                "v": round(v_combined, 4),
                "speed": round(combined_speed, 4),
                "direction": round(combined_direction, 1),
            },
        })

    return {
        "ok": True,
        "timestamp": ts,
        "bbox": list(bbox),
        "resolution": resolution,
        "point_count": len(grid_points),
        "grid": grid_points,
        "physics_assumptions": {
            "windage_factor": windage_factor,
            "coriolis_deflection_deg": coriolis_deflection,
            "formula": "v_drift = v_current + alpha * R(theta) * v_wind",
            "notes": (
                "Surface current transports slick at 100% velocity; "
                "10m wind transfers ~3.0% momentum with 15° clockwise Coriolis deflection in Northern Hemisphere."
            ),
        },
    }
