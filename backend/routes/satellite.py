from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.providers.registry import registry
from backend.services.envelope import with_envelope
from backend.services.segmentation import detect_spill

router = APIRouter()


class SatelliteSearchRequest(BaseModel):
    bbox: List[float] = Field(default_factory=lambda: [71.50, 18.80, 72.20, 19.45])
    start_datetime: str = "2026-03-10T00:00:00Z"
    end_datetime: str = "2026-03-15T23:59:59Z"
    platform: str = "Sentinel-1"
    product_type: str = "GRD"
    polarisation: Optional[str] = "VV+VH"
    max_scenes: int = 10


class SpillDetectRequest(BaseModel):
    scene_id: Optional[str] = None
    image_path: Optional[str] = None
    threshold: float = 0.45
    incident_id: Optional[str] = None


@router.get("/satellite/scenes")
def list_satellite_scenes():
    try:
        scenes = registry.satellite.search_scenes(
            bbox=(71.50, 18.80, 72.20, 19.45),
            start_datetime="2026-03-10T00:00:00Z",
            end_datetime="2026-03-15T23:59:59Z",
            max_scenes=10,
        )
        return with_envelope({"scenes": scenes, "total": len(scenes)})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/satellite/search")
def search_satellite_scenes(req: SatelliteSearchRequest):
    try:
        if len(req.bbox) != 4:
            raise ValueError("BBox must be 4 floats: [min_lon, min_lat, max_lon, max_lat]")
        bbox_tuple = (req.bbox[0], req.bbox[1], req.bbox[2], req.bbox[3])
        scenes = registry.satellite.search_scenes(
            bbox=bbox_tuple,
            start_datetime=req.start_datetime,
            end_datetime=req.end_datetime,
            platform=req.platform,
            product_type=req.product_type,
            polarisation=req.polarisation,
            max_scenes=req.max_scenes,
        )
        return with_envelope({
            "scenes": scenes,
            "total": len(scenes),
            "search_parameters": req.model_dump(),
        })
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/satellite/scenes/{scene_id}")
def get_satellite_scene(scene_id: str):
    scene = registry.satellite.get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Satellite scene {scene_id} not found.")
    return with_envelope(scene)


@router.post("/spills/detect")
@router.post("/detect")
def detect_oil_spill(req: SpillDetectRequest):
    try:
        result = detect_spill(
            image_path=req.image_path,
            threshold=req.threshold,
            scene_id=req.scene_id,
            incident_id=req.incident_id,
        )
        # Drop binary mask from API payload for efficient transfer, keep polygon & previews
        result.pop("binary_mask", None)
        return with_envelope(result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/satellite/live-alert-status")
def get_live_alert_status():
    try:
        # 1. Fetch latest scene from CDSE Copernicus Sentinel-1
        scenes = registry.satellite.search_scenes(
            bbox=(71.50, 18.80, 72.20, 19.45),
            start_datetime="2026-03-10T00:00:00Z",
            end_datetime="2026-03-15T23:59:59Z",
            max_scenes=1,
        )
        latest_scene = scenes[0] if scenes else None

        # 2. Run spill detection
        detection = detect_spill()
        detection.pop("binary_mask", None)

        status = "CRITICAL_SPILL_DETECTED" if detection.get("confidence", 0) > 0.40 else "MONITORING_SECURE"

        return with_envelope({
            "status": status,
            "alert_active": True,
            "surveillance_zone": "Mumbai High Offshore (71.50E-72.20E, 18.80N-19.45N)",
            "latest_scene": latest_scene,
            "detection": detection,
            "recommended_action": "TRIGGER_DRIFT_INVESTIGATION",
            "last_checked": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/satellite/latest")
def get_latest_satellite_scene():
    try:
        from backend.integrations.satellite.sentinel_adapter import SentinelSatelliteAdapter
        scenes = registry.satellite.search_scenes(
            bbox=(71.50, 18.80, 72.20, 19.45),
            start_datetime="2026-03-10T00:00:00Z",
            end_datetime="2026-03-15T23:59:59Z",
            max_scenes=1,
        )
        adapter = SentinelSatelliteAdapter()
        if scenes:
            s = scenes[0]
            norm = adapter.normalize_scene_metadata(
                scene_id=s.get("scene_id", "S1A_IW_GRDH_1SDV_20260314T063000_DEMO"),
                acquisition_time=s.get("start_time", "2026-03-14T06:30:00Z"),
                georef={"north": 19.28, "south": 18.92, "west": 71.62, "east": 72.02},
            )
        else:
            norm = adapter.normalize_scene_metadata(
                scene_id="S1A_IW_GRDH_1SDV_20260314T063000_DEMO",
                acquisition_time="2026-03-14T06:30:00Z",
                georef={"north": 19.28, "south": 18.92, "west": 71.62, "east": 72.02},
            )
        return with_envelope(norm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


