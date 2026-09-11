from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from backend.config import AIS_PATH
from backend.services.incident import resolve_path

REQUIRED = {"mmsi", "timestamp", "latitude", "longitude", "sog", "cog"}


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return float(2 * r * np.arcsin(np.sqrt(a)))


def load_ais(path: str | None = None) -> pd.DataFrame:
    p = resolve_path(path) if path else AIS_PATH
    if not p.exists():
        raise FileNotFoundError(f"AIS file missing: {p}")
    df = pd.read_csv(p)
    missing = REQUIRED - set(c.lower() for c in df.columns)
    df.columns = [c.lower() for c in df.columns]
    missing = REQUIRED - set(df.columns)
    if missing:
        raise ValueError(f"Invalid AIS columns. Missing: {sorted(missing)}. Expected: {sorted(REQUIRED)}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    if df["timestamp"].isna().any():
        raise ValueError("AIS file contains unparseable timestamps.")
    for col in ("latitude", "longitude", "sog", "cog"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    if df[["latitude", "longitude"]].isna().any().any():
        raise ValueError("AIS file contains invalid coordinates.")
    bad = (~df["latitude"].between(-90, 90)) | (~df["longitude"].between(-180, 180))
    if bad.any():
        raise ValueError("AIS file contains out-of-range coordinates.")
    return df.sort_values(["mmsi", "timestamp"])


def _vessel_summary(g: pd.DataFrame, origin: dict, origin_dt: datetime, window_hours: float, spatial_km: float) -> dict:
    dists = [
        haversine_km(origin["latitude"], origin["longitude"], r.latitude, r.longitude) for r in g.itertuples()
    ]
    min_dist = min(dists)
    nearest = g.iloc[int(np.argmin(dists))]
    times = g["timestamp"]
    gaps = times.diff().dt.total_seconds().fillna(0) / 3600.0
    max_gap_h = float(gaps.max()) if len(gaps) else 0.0
    in_window = (times - origin_dt).abs() <= pd.Timedelta(hours=window_hours)
    temporal_hit = bool(in_window.any())
    spatial_hit = min_dist <= spatial_km
    # trajectory: heading toward/away from origin vs mean COG
    dlat = origin["latitude"] - g["latitude"].iloc[0]
    dlon = origin["longitude"] - g["longitude"].iloc[0]
    bearing = (np.degrees(np.arctan2(dlon, dlat)) + 360) % 360
    mean_cog = float(g["cog"].mean())
    heading_delta = min(abs(mean_cog - bearing), 360 - abs(mean_cog - bearing))
    sog_min = float(g["sog"].min())
    slow = sog_min < 1.5
    has_heading = "heading" in g.columns
    mean_heading = float(g["heading"].mean()) if has_heading else None
    track = []
    for row in g.itertuples():
        iso_t = row.timestamp.isoformat().replace("+00:00", "Z")
        rec = {
            "time": iso_t,
            "timestamp": iso_t,
            "latitude": round(float(row.latitude), 5),
            "longitude": round(float(row.longitude), 5),
            "lat": round(float(row.latitude), 5),
            "lon": round(float(row.longitude), 5),
            "sog": round(float(row.sog), 2),
            "speed": round(float(row.sog), 2),
            "cog": round(float(row.cog), 1),
            "course": round(float(row.cog), 1),
        }
        if has_heading and not pd.isna(getattr(row, "heading", None)):
            rec["heading"] = round(float(row.heading), 1)
        track.append(rec)
    consistent = heading_delta < 70 or slow
    name = str(g["vessel_name"].iloc[0]) if "vessel_name" in g.columns else f"MMSI {g['mmsi'].iloc[0]}"
    vtype = str(g["vessel_type"].iloc[0]) if "vessel_type" in g.columns else "unknown"
    nearest_iso = nearest.timestamp.isoformat().replace("+00:00", "Z")
    nearest_hdg = float(nearest.heading) if (has_heading and not pd.isna(getattr(nearest, "heading", None))) else float(nearest.cog)
    out = {
        "mmsi": int(g["mmsi"].iloc[0]),
        "name": name,
        "vessel_name": name,
        "vessel_type": vtype,
        "type": vtype,
        "latitude": round(float(nearest.latitude), 5),
        "longitude": round(float(nearest.longitude), 5),
        "lat": round(float(nearest.latitude), 5),
        "lon": round(float(nearest.longitude), 5),
        "sog": round(float(nearest.sog), 2),
        "speed": round(float(nearest.sog), 2),
        "cog": round(float(nearest.cog), 1),
        "course": round(float(nearest.cog), 1),
        "heading": round(nearest_hdg, 1),
        "timestamp": nearest_iso,
        "points": len(g),
        "min_distance_km": round(min_dist, 2),
        "nearest_time": nearest_iso,
        "mean_sog": round(float(g["sog"].mean()), 2),
        "min_sog": round(sog_min, 2),
        "mean_cog": round(mean_cog, 1),
        "heading_delta_deg": round(float(heading_delta), 1),
        "max_ais_gap_hours": round(max_gap_h, 2),
        "spatial_candidate": spatial_hit,
        "temporal_candidate": temporal_hit,
        "trajectory_consistent": bool(consistent),
        "slow_or_stopped": slow,
        "track": track,
    }
    if mean_heading is not None:
        out["mean_heading"] = round(mean_heading, 1)
    return out


def analyze_ais(
    origin: dict,
    origin_time: str,
    ais_path: str | None = None,
    window_hours: float = 3.0,
    spatial_km: float = 25.0,
) -> dict:
    df = load_ais(ais_path)
    origin_dt = _parse_time(origin_time)
    summaries = [_vessel_summary(g, origin, origin_dt, window_hours, spatial_km) for _, g in df.groupby("mmsi")]
    spatial = [v for v in summaries if v["spatial_candidate"]]
    temporal = [v for v in spatial if v["temporal_candidate"]]
    final = [v for v in temporal if v["trajectory_consistent"] or v["min_distance_km"] < 12]
    if not summaries:
        raise ValueError("Insufficient vessel data: AIS file has no records.")
    return {
        "ok": True,
        "data_provenance": "SYNTHETIC DEMONSTRATION DATA",
        "total_vessels": len(summaries),
        "vessels_considered": len(summaries),
        "vessels_filtered": len(summaries) - len(final),
        "spatial_candidates": len(spatial),
        "temporal_candidates": len(temporal),
        "final_candidates": len(final),
        "candidate_vessels": final,
        "vessels": summaries,
        "candidates": final,
        "ais_label": "Synthetic demonstration AIS",
        "filters": {
            "spatial_km": spatial_km,
            "window_hours": window_hours,
        },
        "status": "Completed" if final else "Warning",
        "warning": None if final else "No vessels passed all filters. Ranking will use spatial-temporal candidates.",
        "fallback_candidates": temporal if not final else final,
    }
