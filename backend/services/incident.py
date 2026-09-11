from __future__ import annotations

import json
from pathlib import Path

from backend.config import INCIDENT_PATH, ROOT


def load_incident(path: str | None = None) -> dict:
    p = Path(path) if path else INCIDENT_PATH
    if not p.is_absolute():
        p = ROOT / p
    if not p.exists():
        raise FileNotFoundError(f"Incident configuration not found: {p}")
    with p.open(encoding="utf-8") as f:
        data = json.load(f)
    data["data_provenance"] = data.get("data_provenance", "SYNTHETIC DEMONSTRATION DATA")
    return data


def resolve_path(rel: str) -> Path:
    p = Path(rel)
    if not p.is_absolute():
        p = ROOT / p
    return p
