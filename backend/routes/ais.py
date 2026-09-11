from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.providers.registry import registry
from backend.schemas import AISAnalyzeRequest
from backend.services.ais_processor import analyze_ais
from backend.services.envelope import with_envelope

router = APIRouter()


class AISFilterRequest(BaseModel):
    origin: Dict[str, Any] = Field(default_factory=lambda: {"latitude": 19.12, "longitude": 71.85})
    origin_time: str = "2026-03-14T02:00:00Z"
    window_hours: float = 3.0
    spatial_km: float = 35.0
    corridor: Optional[List[List[float]]] = None
    bbox: Optional[List[float]] = None


@router.get("/ais/vessels")
@router.get("/vessels")
def get_vessels(
    min_lon: Optional[float] = Query(None),
    min_lat: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    provider: Optional[str] = Query(None, description="AIS provider: 'incois', 'marinecadastre', 'vesselfinder', 'demo'"),
):
    try:
        if provider:
            registry.set_ais_provider(provider)

        bbox = None
        if None not in (min_lon, min_lat, max_lon, max_lat):
            bbox = (min_lon, min_lat, max_lon, max_lat)
        window = (start_time, end_time) if (start_time and end_time) else None
        vessels = registry.ais.get_vessels(bbox=bbox, time_window=window)
        ais_health = registry.ais.get_health()

        # Ensure all vessels have top-level coordinates and timestamps
        clean_vessels = []
        for v in vessels:
            item = dict(v)
            if "latitude" not in item or item["latitude"] is None:
                item["latitude"] = item.get("lat", 19.12)
            if "longitude" not in item or item["longitude"] is None:
                item["longitude"] = item.get("lon", 71.85)
            if "sog" not in item:
                item["sog"] = item.get("speed", 10.0)
            if "cog" not in item:
                item["cog"] = item.get("course", item.get("heading", 90.0))
            if "timestamp" not in item:
                item["timestamp"] = datetime.now(timezone.utc).isoformat()
            clean_vessels.append(item)

        status_label = ais_health.get("status", "ONLINE")
        prov_name = ais_health.get("provider", "INCOIS OON")
        data_mode = "LIVE" if status_label == "ONLINE" and "VesselFinder" in prov_name else (
            "HISTORICAL" if "MarineCadastre" in prov_name else (
                "LIVE" if status_label == "ONLINE" else "SIMULATED"
            )
        )

        return with_envelope({
            "vessels": clean_vessels,
            "total_vessels": len(clean_vessels),
            "bbox": list(bbox) if bbox else None,
            "provider": prov_name,
            "source_type": data_mode,
            "data_mode": data_mode,
            "status": data_mode,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/vessels/nearby")
@router.get("/ais/vessels/nearby")
def get_nearby_vessels(
    lat: float = Query(19.12, description="Latitude"),
    lon: float = Query(71.85, description="Longitude"),
    radius_km: float = Query(50.0, description="Search radius in kilometers"),
    window_hours: float = Query(6.0, description="Temporal window in hours"),
    timestamp: Optional[str] = Query(None, description="ISO origin timestamp"),
):
    try:
        t = timestamp or "2026-03-14T02:00:00Z"
        res = registry.ais.filter_vessels(
            origin={"latitude": lat, "longitude": lon},
            origin_time=t,
            window_hours=window_hours,
            spatial_km=radius_km,
        )
        return with_envelope(res)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ais/filter")
def filter_ais_vessels(req: AISFilterRequest):
    try:
        res = registry.ais.filter_vessels(
            origin=req.origin,
            origin_time=req.origin_time,
            window_hours=req.window_hours,
            spatial_km=req.spatial_km,
            corridor=req.corridor,
        )
        return with_envelope(res)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/ais/analyze")
def legacy_ais_analyze(req: AISAnalyzeRequest):
    try:
        return with_envelope(
            analyze_ais(
                origin=req.origin,
                origin_time=req.origin_time,
                ais_path=req.ais_path,
                window_hours=req.window_hours,
                spatial_km=req.spatial_km,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/ais/vessel/{mmsi}")
@router.get("/vessels/{mmsi}")
def get_vessel_by_mmsi(mmsi: int):
    v = registry.ais.get_vessel(mmsi)
    if not v:
        raise HTTPException(status_code=404, detail=f"Vessel with MMSI {mmsi} not found.")
    return with_envelope(v)


@router.get("/ais/track/{mmsi}")
def get_vessel_track(mmsi: int):
    track = registry.ais.get_track(mmsi)
    if not track:
        raise HTTPException(status_code=404, detail=f"No track points found for MMSI {mmsi}.")
    return with_envelope({
        "mmsi": mmsi,
        "track": track,
        "point_count": len(track),
    })
