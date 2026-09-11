from __future__ import annotations

from typing import Any


DEFAULT_PROVENANCE = "SYNTHETIC DEMONSTRATION DATA"


def with_envelope(
    payload: dict[str, Any],
    *,
    warnings: list[str] | None = None,
    provenance: str | None = None,
    success: bool | None = None,
) -> dict[str, Any]:
    """Attach success / warnings / provenance without hiding existing fields.

    The dashboard reads top-level keys (detection, hindcast, …). Nested ``data``
    duplicates the same payload for API consumers that expect the SIH envelope.
    """
    out = dict(payload)
    warn = list(warnings or [])
    if out.get("warning"):
        w = str(out["warning"])
        if w not in warn:
            warn.append(w)
    ok = out.get("ok", True)
    out["success"] = bool(ok if success is None else success)
    out["warnings"] = warn
    out["provenance"] = provenance or out.get("data_provenance") or DEFAULT_PROVENANCE
    compact = {k: v for k, v in out.items() if k not in {"data"}}
    out["data"] = compact
    return out
