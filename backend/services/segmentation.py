from __future__ import annotations

import base64
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import cv2
import numpy as np
from PIL import Image

from backend.config import ROOT, SAR_PATH
from backend.services.characterization import characterize_mask
from backend.services.incident import load_incident, resolve_path


def _encode_png(array: np.ndarray) -> str:
    if array.ndim == 2:
        img = Image.fromarray(array.astype(np.uint8), mode="L")
    else:
        img = Image.fromarray(array.astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _colorize_mask(mask: np.ndarray, sar: np.ndarray) -> np.ndarray:
    rgb = np.stack([sar, sar, sar], axis=-1)
    overlay = rgb.copy()
    overlay[mask > 0] = np.array([210, 64, 48], dtype=np.uint8)
    return (0.65 * rgb + 0.35 * overlay).astype(np.uint8)


def detect_spill(
    image_path: str | None = None,
    threshold: float = 0.45,
    scene_id: Optional[str] = None,
    incident_id: Optional[str] = None,
) -> dict:
    incident = load_incident()
    path = resolve_path(image_path) if image_path else SAR_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"SAR image missing: {path}. Run `python data/generate_demo_assets.py` or provide a valid image."
        )

    try:
        Image.open(path).verify()
    except Exception as exc:
        raise ValueError(f"Invalid SAR image: {path}") from exc

    import sys
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from ml.inference import run_inference

    result = run_inference(str(path), threshold=threshold)
    binary = result["binary_mask"].astype(np.uint8)
    if binary.sum() == 0:
        raise ValueError("Empty detection mask: no slick-like region was found in the SAR image.")

    sar = np.array(Image.open(path).convert("L"))
    overlay = _colorize_mask(binary, sar)
    georef = incident.get("georef")

    # Run geometric characterization
    char = characterize_mask(binary, georef=georef, confidence=result.get("confidence", 0.0))

    iid = incident_id or incident.get("incident_id", "MG-2026-001")
    scene = scene_id or "S1A_IW_GRDH_1SDV_20260314T063000_DEMO"
    det_time = incident.get("observation_time", datetime.now(timezone.utc).isoformat())

    return {
        "ok": True,
        "detected": True,
        "incident_id": iid,
        "source_scene": scene,
        "detection_timestamp": det_time,
        "confidence": result["confidence"],
        "centroid": char["centroid"],
        "polygon": char.get("geojson_polygon", {"type": "Polygon", "coordinates": [char["polygon"]]}),
        "polygon_coords": char["polygon"],
        "bounding_box": char.get("bounding_box"),
        "bbox": char.get("bbox"),
        "area_km2": char["area_km2"],
        "perimeter_km": char["perimeter_km"],
        "length_km": char["length_km"],
        "width_km": char["width_km"],
        "aspect_ratio": char.get("aspect_ratio"),
        "shape_characteristics": char.get("shape_characteristics"),
        "mode": result["mode"],
        "mode_label": result["mode_label"],
        "disclaimer": result["disclaimer"],
        "threshold": result["threshold"],
        "image_shape": result["image_shape"],
        "binary_mask": binary.tolist(),
        "probability_preview": _encode_png((result["probability"] * 255).astype(np.uint8)),
        "original_preview": _encode_png(sar),
        "mask_preview": _encode_png(overlay),
        "georef": georef,
        "data_provenance": incident.get("data_provenance", "SYNTHETIC DEMONSTRATION DATA"),
        "status": "Completed",
        "model_weights_available": bool(result.get("weights_path")),
    }
