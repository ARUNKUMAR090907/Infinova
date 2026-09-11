from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.schemas import DetectRequest
from backend.services.envelope import with_envelope
from backend.services.segmentation import detect_spill

router = APIRouter()


@router.post("/detect")
def detect(req: DetectRequest):
    try:
        result = detect_spill(req.image_path, req.threshold)
        result.pop("binary_mask", None)
        return with_envelope(result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/spill/detect")
def spill_detect(req: DetectRequest):
    try:
        result = detect_spill(req.image_path, req.threshold)
        result.pop("binary_mask", None)
        return with_envelope(result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
