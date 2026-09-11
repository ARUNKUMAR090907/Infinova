from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union


def create_provenance(
    provider: str,
    source_type: str,  # "LIVE" | "CACHED" | "DEMO"
    dataset: str,
    observation_time: Optional[str] = None,
    spatial_extent: Optional[Union[List[float], Dict[str, Any], str]] = None,
    temporal_extent: Optional[Union[List[str], str]] = None,
    quality: float = 0.95,
    license_info: str = "Open Access / Copernicus Open Data",
    fallback_used: bool = False,
    fallback_reason: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates standardized, traceable provenance metadata for any ingested data element."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "provider": provider,
        "source_type": source_type.upper(),
        "retrieved_at": now_iso,
        "observation_time": observation_time or now_iso,
        "request_id": request_id or f"req-{uuid.uuid4().hex[:8]}",
        "dataset": dataset,
        "spatial_extent": spatial_extent,
        "temporal_extent": temporal_extent,
        "quality": round(float(quality), 3),
        "license": license_info,
        "fallback_used": fallback_used,
        "fallback_reason": fallback_reason,
    }
