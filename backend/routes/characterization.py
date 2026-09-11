from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.schemas import CharacterizeRequest
from backend.services.characterization import characterize_mask
from backend.services.envelope import with_envelope
from backend.services.segmentation import detect_spill

router = APIRouter()


@router.post("/characterize")
def characterize(req: CharacterizeRequest):
    try:
        if req.mask is not None:
            mask = req.mask
            georef = req.georef
            confidence = 0.0
        else:
            det = detect_spill(req.image_path, req.threshold)
            mask = det["binary_mask"]
            georef = req.georef or det.get("georef")
            confidence = det.get("confidence", 0)
        return with_envelope(characterize_mask(mask, georef=georef, confidence=confidence))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
