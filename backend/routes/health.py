from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.providers.registry import registry
from backend.services.envelope import with_envelope

router = APIRouter()


@router.get(
    "/health",
    summary="System Health",
    description=(
        "Returns overall system health, data mode (LIVE/HYBRID/DEMO), and a per-provider summary. "
        "In HYBRID mode, satellite/ocean/wind are queried from live open scientific feeds; "
        "AIS uses the verified historical archive when no commercial key is configured."
    ),
    tags=["health"],
)
def health():
    all_health = registry.get_all_health()
    providers = all_health.get("providers", {})
    mode = all_health.get("data_mode", "UNKNOWN")

    # Compose an honest note for the response
    note = None
    if mode == "HYBRID":
        note = (
            "System is operating in HYBRID mode. "
            "Satellite (CDSE), Ocean (CMEMS), and Wind (ERA5) data are live open feeds. "
            "AIS vessel data uses a verified historical archive (commercial VesselFinder key not configured)."
        )
    elif mode == "DEMO":
        note = "All providers are operating in demonstration mode with clearly labelled synthetic datasets."
    elif mode == "LIVE":
        note = "All providers are connected to live external data feeds."

    return with_envelope({
        "status": "ok",
        "data_mode": mode,
        "configured_mode": all_health.get("configured_mode", mode),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": note,
        "providers_summary": {
            k: {
                "status": v.get("status"),
                "latency_ms": v.get("latency_ms"),
                "provider": v.get("provider"),
            }
            for k, v in providers.items()
        },
    })


@router.get(
    "/health/data-sources",
    summary="Detailed Provider Health",
    description=(
        "Returns detailed health for each data provider: status, latency, last check, errors, and provenance. "
        "Status values: ONLINE (live connection), DEMO (demonstration data), "
        "NOT_CONFIGURED (key missing), OFFLINE (connection failed), DEGRADED (partial)."
    ),
    tags=["health"],
)
@router.get("/data-status", tags=["health"])
def health_data_sources():
    all_health = registry.get_all_health()
    return with_envelope(all_health)


@router.post(
    "/health/test/{provider_id}",
    summary="Test Provider Connectivity",
    description=(
        "Triggers a live connectivity probe for a specific provider. "
        "Valid provider IDs: cdse, ais, ocean, weather."
    ),
    tags=["health"],
)
def test_provider_connection(provider_id: str):
    p = provider_id.lower()
    t0 = time.time()
    result = None

    if "sat" in p or "cdse" in p or "sentinel" in p:
        result = registry.satellite.get_health()
    elif "ais" in p or "vessel" in p:
        result = registry.ais.get_health()
    elif "incois" in p:
        result = registry.incois_ocean.get_health()
    elif "ocean" in p or "marine" in p or "current" in p:
        result = registry.ocean.get_health()
    elif "wind" in p or "weather" in p or "era5" in p:
        result = registry.weather.get_health()
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown provider: '{provider_id}'. Valid options: cdse, ais, incois, ocean, weather",
        )

    latency = round((time.time() - t0) * 1000, 1)
    result["test_latency_ms"] = latency
    result["tested_at"] = datetime.now(timezone.utc).isoformat()
    return with_envelope(result)


class ModeRequest(BaseModel):
    mode: str = Field(..., description="Operating mode: 'live' or 'demo'")


@router.get("/health/mode", summary="Get Operating Mode", tags=["health"])
def get_mode():
    return with_envelope({
        "mode": registry.get_mode().upper(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@router.post("/health/mode", summary="Set Operating Mode", tags=["health"])
def set_mode(req: ModeRequest):
    new_mode = registry.set_mode(req.mode)
    return with_envelope({
        "mode": new_mode.upper(),
        "message": f"Operational mode switched to {new_mode.upper()}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


class AISProviderRequest(BaseModel):
    provider: str = Field(..., description="AIS provider: 'incois', 'marinecadastre', 'vesselfinder', 'demo'")


@router.post("/health/ais-provider", summary="Set AIS Provider", tags=["health"])
def set_ais_provider(req: AISProviderRequest):
    active = registry.set_ais_provider(req.provider)
    return with_envelope({
        "active_provider": active,
        "provider_name": registry.ais.get_health().get("provider"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/health/telemetry", summary="System Telemetry & Data Provenance", tags=["health"])
def get_telemetry():
    return with_envelope(registry.get_telemetry())


class SyncDataRequest(BaseModel):
    bbox: Optional[List[float]] = Field(default_factory=lambda: [71.50, 18.80, 72.20, 19.45])


@router.post(
    "/providers/sync-live-data",
    summary="Synchronize Live Data Across All 4 Providers",
    description="Fetches live data from CDSE Sentinel-1, CMEMS Ocean Currents, CDS/ERA5 Winds, and VesselFinder AIS.",
    tags=["health"],
)
def sync_live_data(req: SyncDataRequest | None = None):
    try:
        bbox = tuple(req.bbox) if req and req.bbox and len(req.bbox) == 4 else (71.50, 18.80, 72.20, 19.45)
        from backend.services.data_fetcher import fetch_all_live_data
        result = fetch_all_live_data(bbox=bbox)
        return with_envelope(result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


