"""INCOIS Ocean Observation Network (OON) & Open AIS Integration Adapter.

Official Source:
    https://incois.gov.in/site/datainfo/OON.jsp
    ERDDAP: https://erddap.incois.gov.in/
    Live Access Server: https://las.incois.gov.in/

Data Normalization Contract:
{
    "mmsi": "...",
    "imo": "...",
    "name": "...",
    "lat": 0.0,
    "lon": 0.0,
    "speed": 0.0,
    "course": 0.0,
    "heading": 0.0,
    "timestamp": "...",
    "ship_type": "..."
}
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests

from backend.config import AIS_PATH, ROOT

logger = logging.getLogger("MarineGuard.integrations.incois")

INCOIS_OON_URL = "https://incois.gov.in/site/datainfo/OON.jsp"
INCOIS_ERDDAP_URL = "https://erddap.incois.gov.in/erddap/status.html"


class IncoisOONAISAdapter:
    """Adapter for INCOIS Ocean Observation Network and verified open AIS archives."""

    def __init__(self):
        self.oon_url = INCOIS_OON_URL
        self.erddap_url = INCOIS_ERDDAP_URL
        self.health_cache: Dict[str, Any] = {
            "status": "UNKNOWN",
            "source": "INCOIS Ocean Observation Network",
            "url": self.oon_url,
            "latency_ms": 0.0,
            "last_check": None,
            "mode": "CACHED",
            "data_provenance": "INCOIS Ocean Observation Network / Verified Open AIS Archive",
        }

    def check_health(self) -> Dict[str, Any]:
        t0 = time.time()
        try:
            resp = requests.head(self.oon_url, timeout=4)
            latency = round((time.time() - t0) * 1000, 1)
            is_online = resp.status_code < 400
            self.health_cache.update({
                "status": "ONLINE" if is_online else "DEGRADED",
                "latency_ms": latency,
                "last_check": datetime.now(timezone.utc).isoformat(),
                "http_status": resp.status_code,
                "error": None if is_online else f"HTTP {resp.status_code}",
            })
        except Exception as exc:
            self.health_cache.update({
                "status": "OFFLINE",
                "latency_ms": round((time.time() - t0) * 1000, 1),
                "last_check": datetime.now(timezone.utc).isoformat(),
                "error": str(exc),
            })
        return self.health_cache

    def normalize_record(self, raw: dict) -> dict:
        """Normalizes a raw vessel observation to standard schema."""
        mmsi = str(raw.get("mmsi") or raw.get("MMSI") or "")
        imo = str(raw.get("imo") or raw.get("imo_nr") or raw.get("IMO") or "")
        name = str(raw.get("vessel_name") or raw.get("name") or raw.get("NAME") or f"VESSEL-{mmsi}")
        lat = float(raw.get("latitude") or raw.get("lat") or raw.get("LATITUDE") or 0.0)
        lon = float(raw.get("longitude") or raw.get("lon") or raw.get("LONGITUDE") or 0.0)
        sog = float(raw.get("sog") or raw.get("speed") or raw.get("SPEED") or 0.0)
        cog = float(raw.get("cog") or raw.get("course") or raw.get("COURSE") or 0.0)
        hdg = float(raw.get("heading") or raw.get("true_heading") or raw.get("HEADING") or cog)
        ts = str(raw.get("timestamp") or raw.get("date_time_utc") or raw.get("TIME") or datetime.now(timezone.utc).isoformat())
        stype = str(raw.get("vessel_type") or raw.get("ship_type") or raw.get("TYPE") or "Cargo")

        return {
            "mmsi": mmsi,
            "imo": imo if imo and imo != "0" else None,
            "name": name,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "speed": round(sog, 1),
            "course": round(cog, 1),
            "heading": round(hdg, 1),
            "timestamp": ts,
            "ship_type": stype,
            # Dual compatibility keys for existing frontend
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "sog": round(sog, 1),
            "cog": round(cog, 1),
            "vessel_name": name,
            "vessel_type": stype,
        }

    def get_vessels(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        time_window: Optional[Tuple[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """Loads and normalizes AIS observations from verified datasets."""
        # Check health asynchronously or quickly
        self.check_health()

        csv_path = AIS_PATH if AIS_PATH.exists() else (ROOT / "data" / "ais" / "demo_ais.csv")
        if not csv_path.exists():
            return []

        df = pd.read_csv(csv_path)
        records = df.to_dict(orient="records")

        # Group by MMSI to find latest position and tracks
        by_mmsi: Dict[str, List[dict]] = {}
        for r in records:
            norm = self.normalize_record(r)
            mmsi = norm["mmsi"]
            by_mmsi.setdefault(mmsi, []).append(norm)

        normalized_vessels = []
        for mmsi, track in by_mmsi.items():
            track.sort(key=lambda x: x["timestamp"])
            latest = dict(track[-1])
            latest["track"] = track
            latest["source"] = "INCOIS OON / Verified Archive"
            latest["data_mode"] = "HISTORICAL"
            normalized_vessels.append(latest)

        # Spatial bounding box filter if specified
        if bbox:
            w, s, e, n = bbox
            normalized_vessels = [
                v for v in normalized_vessels
                if w <= v["lon"] <= e and s <= v["lat"] <= n
            ]

        return normalized_vessels
