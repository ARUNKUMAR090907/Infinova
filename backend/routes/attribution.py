from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.schemas import AttributeRequest
from backend.services.envelope import with_envelope
from backend.services.vessel_scoring import score_vessels

router = APIRouter()


class AttributionPayload(BaseModel):
    candidates: List[Dict[str, Any]] = Field(default_factory=list)
    origin: Dict[str, Any] = Field(default_factory=lambda: {"latitude": 19.12, "longitude": 71.85})
    origin_time: str = "2026-03-14T02:00:00Z"


@router.post("/attribution")
@router.post("/vessels/attribute")
@router.post("/attribute")
def attribute_vessels(req: AttributionPayload):
    try:
        scored = score_vessels(req.candidates, req.origin, req.origin_time)
        return with_envelope(scored)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/investigations/{incident_id}/rank-vessels")
@router.get("/investigations/{incident_id}/rank-vessels")
def rank_vessels_for_investigation(incident_id: str):
    try:
        from backend.services.pipeline import run_investigation
        inv = run_investigation()
        attr = inv.get("attribution", {})
        ranked = attr.get("ranked", [])
        return with_envelope({
            "incident_id": incident_id,
            "ranked_vessels": ranked,
            "count": len(ranked),
            "top_suspect": ranked[0] if ranked else None,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
