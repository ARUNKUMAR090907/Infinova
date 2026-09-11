from __future__ import annotations

import math
from datetime import timedelta
from typing import Any, Dict, List, Optional

import numpy as np

from backend.services.hindcast import (
    _parse_time,
    effective_drift,
    interpolate_forcing,
    load_ocean,
    step_position,
)


def _corridor(points: list[dict], width_km: float) -> list[list[float]]:
    """Build a GeoJSON polygon ring (lon, lat) around the forecast polyline."""
    if len(points) < 2:
        return []
    left, right = [], []
    for i, p in enumerate(points):
        lat, lon = p["latitude"], p["longitude"]
        if i < len(points) - 1:
            nlat, nlon = points[i + 1]["latitude"], points[i + 1]["longitude"]
        else:
            plat, plon = points[i - 1]["latitude"], points[i - 1]["longitude"]
            nlat, nlon = lat + (lat - plat), lon + (lon - plon)
        dlat, dlon = nlat - lat, nlon - lon
        norm = max(math.hypot(dlat, dlon), 1e-9)
        km_lat = 111.32
        km_lon = 111.32 * max(math.cos(math.radians(lat)), 0.2)
        dlon_p = (-dlat / norm) * (width_km / km_lon)
        dlat_p = (dlon / norm) * (width_km / km_lat)
        left.append([round(lon + dlon_p, 5), round(lat + dlat_p, 5)])
        right.append([round(lon - dlon_p, 5), round(lat - dlat_p, 5)])
    return left + list(reversed(right)) + [left[0]]


def run_forecast(
    centroid: dict,
    observation_time: str,
    ocean_path: str | None = None,
    horizons_hours: list[float] | None = None,
) -> dict:
    horizons_hours = horizons_hours or [6, 12, 24, 48]
    df = load_ocean(ocean_path)
    t0 = _parse_time(observation_time)
    lat = float(centroid.get("latitude") or centroid.get("lat") or 19.12)
    lon = float(centroid.get("longitude") or centroid.get("lon") or centroid.get("lng") or 71.85)

    points = [
        {
            "hours_ahead": 0,
            "time": t0.isoformat().replace("+00:00", "Z"),
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "uncertainty_radius_km": 1.5,
        }
    ]

    vectors_used = []
    prev_h = 0.0
    cur_lat, cur_lon = lat, lon

    for h in sorted(horizons_hours):
        dt = h - prev_h
        t = t0 + timedelta(hours=h)
        forcing = interpolate_forcing(df, t)
        u, v = effective_drift(forcing)
        cur_lat, cur_lon = step_position(cur_lat, cur_lon, u, v, dt)

        # Spreading uncertainty grows with lead time
        unc_km = round(1.5 + 0.35 * h, 2)
        points.append({
            "hours_ahead": h,
            "time": t.isoformat().replace("+00:00", "Z"),
            "latitude": round(cur_lat, 5),
            "longitude": round(cur_lon, 5),
            "uncertainty_radius_km": unc_km,
        })
        vectors_used.append({
            "lead_hours": h,
            "time": t.isoformat().replace("+00:00", "Z"),
            "forcing": forcing,
            "drift_speed_ms": round(float(math.hypot(u, v)), 3),
        })
        prev_h = h

    max_horizon = max(horizons_hours)
    width_km = round(2.0 + 0.45 * max_horizon, 2)
    corridor = _corridor(points, width_km)

    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"type": "forecast_trajectory", "label": "Forward Drift Trajectory"},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[p["longitude"], p["latitude"]] for p in points],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "type": "uncertainty_corridor",
                    "width_km": width_km,
                    "label": f"+{max_horizon}h Drift Uncertainty Corridor",
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [corridor],
                },
            },
        ],
    }

    return {
        "ok": True,
        "model": "forward_euler_drift_forecast",
        "disclaimer": (
            "Forward trajectory forecast incorporates predicted hydrodynamic surface current and 3% wind leeway. "
            "Uncertainty corridor expands over time due to oceanic turbulence and atmospheric variation."
        ),
        "label": f"Forward drift forecast (+{int(max_horizon)}h)",
        "points": points,
        "trajectory": points,
        "uncertainty_corridor": corridor,
        "uncertainty_width_km": width_km,
        "forecast_horizon_hours": max_horizon,
        "horizons_hours": horizons_hours,
        "environmental_vectors_used": vectors_used,
        "geojson": geojson,
        "confidence": round(max(0.40, 0.85 - 0.008 * max_horizon), 2),
        "status": "Completed",
    }
