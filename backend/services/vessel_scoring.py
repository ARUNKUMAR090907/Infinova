from __future__ import annotations

import math
from typing import Any, Dict, List, Optional


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _classification(score: float) -> str:
    if score >= 75:
        return "HIGH-PROBABILITY INVESTIGATION CANDIDATE (Potential Suspect Vessel)"
    if score >= 45:
        return "MEDIUM-PROBABILITY INVESTIGATION CANDIDATE (Candidate Vessel)"
    return "LOW-PROBABILITY INVESTIGATION CANDIDATE (Low Priority)"


def _priority(score: float) -> str:
    if score >= 75:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


DEFAULT_WEIGHTS = {
    "spatial": 0.25,
    "temporal": 0.25,
    "trajectory": 0.20,
    "wind": 0.15,
    "current": 0.15,
}


def score_vessels(
    candidates: list[dict],
    origin: dict,
    origin_time: str,
    weights: Optional[dict] = None,
) -> dict:
    """Scores candidate vessels against probable spill origin using explainable multi-factor weighting.
    
    Overall Score =
        0.25 * Spatial Compatibility
      + 0.25 * Temporal Compatibility
      + 0.20 * Trajectory Compatibility
      + 0.15 * Wind Compatibility
      + 0.15 * Current Compatibility
    
    Weights are fully configurable.
    
    IMPORTANT LEGAL DISCLAIMER:
    This is an investigative ranking designed to prioritize maritime inspection resources.
    It does NOT constitute proof of guilt, liability, or legal responsibility.
    """
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update(weights)

    if not candidates:
        return {
            "ok": True,
            "ranked": [],
            "status": "Warning",
            "warning": "No candidate vessels within origin corridor for analytical ranking.",
            "disclaimer": (
                "Attribution scoring provides objective decision support for authorized maritime authorities. "
                "Rankings identify investigation candidates and do not establish legal liability."
            ),
            "analytical_weights": w,
        }

    ranked = []
    for v in candidates:
        dist = float(v.get("min_distance_km", 99.0))
        # 1. Spatial Compatibility (0.25)
        # Scales from 100% at 0km to 0% at 35km
        spatial = _clamp01(1.0 - (dist / 35.0))
        spatial_pct = round(100.0 * spatial, 1)

        # 2. Temporal Compatibility (0.25)
        # Transmissions overlapping the estimated release window
        temporal = 1.0 if v.get("temporal_candidate") else 0.35
        gap_hours = float(v.get("max_ais_gap_hours", 0.0))
        if gap_hours > 2.0:
            temporal *= 0.85
        temporal = _clamp01(temporal)
        temporal_pct = round(100.0 * temporal, 1)

        # 3. Trajectory Compatibility (0.20)
        # Heading delta relative to inferred drift axis
        heading_delta = float(v.get("heading_delta_deg", 90.0))
        traj = 0.88 if v.get("trajectory_consistent") else 0.35
        traj *= (_clamp01(1.0 - (heading_delta / 140.0)) * 0.5 + 0.5)
        traj = _clamp01(traj)
        traj_pct = round(100.0 * traj, 1)

        # 4. Wind Compatibility (0.15)
        # Consistency with upwind/downwind dispersion vector
        # Slower speed or loitering near origin enhances downwind compatibility
        min_sog = float(v.get("min_sog", v.get("sog", 10.0)))
        wind_comp = 0.85 if min_sog < 3.0 else 0.65
        if heading_delta < 45.0:
            wind_comp += 0.15
        wind_comp = _clamp01(wind_comp)
        wind_pct = round(100.0 * wind_comp, 1)

        # 5. Current Compatibility (0.15)
        # Ocean current hydrodynamic consistency
        current_comp = 0.90 if v.get("trajectory_consistent") else 0.60
        if dist < 10.0:
            current_comp += 0.10
        current_comp = _clamp01(current_comp)
        current_pct = round(100.0 * current_comp, 1)

        # Composite overall score
        composite = (
            w["spatial"] * spatial
            + w["temporal"] * temporal
            + w["trajectory"] * traj
            + w["wind"] * wind_comp
            + w["current"] * current_comp
        )
        overall_score = round(100.0 * composite, 1)
        classification_label = _classification(overall_score)
        priority_label = _priority(overall_score)

        evidence = [
            f"Spatial compatibility: {spatial_pct}% (Closest approach: {dist:.1f} km from probable origin region).",
            f"Temporal compatibility: {temporal_pct}% (Transmissions {'align with' if v.get('temporal_candidate') else 'precede/succeed'} the origin time window).",
            f"Trajectory compatibility: {traj_pct}% (Heading delta {heading_delta:.1f}° relative to drift axis).",
            f"Wind compatibility: {wind_pct}% (Navigational state consistent with atmospheric leeway dispersion).",
            f"Current compatibility: {current_pct}% (Positioning consistent with hydrodynamic current drift).",
            f"Operating speed: min {min_sog:.1f} kn, mean {float(v.get('mean_sog', 0.0)):.1f} kn." + (" (Loitering detected)" if min_sog < 2.0 else ""),
        ]

        counter_evidence = []
        if dist > 15.0:
            counter_evidence.append(f"Vessel remained {dist:.1f} km away from estimated origin centroid.")
        if min_sog > 8.0:
            counter_evidence.append(f"Maintained steady transit speed of {min_sog:.1f} kn without recorded speed anomalies.")
        if gap_hours == 0.0 or gap_hours < 0.5:
            counter_evidence.append("Continuous, uninterrupted AIS transmission record with no suspicious temporal gaps.")

        data_quality = "Good (Regular AIS Transponder Telemetry)" if gap_hours < 1.0 else f"Moderate ({gap_hours:.1f}h AIS coverage gap)"

        ranked.append({
            **v,
            "score": overall_score,
            "overall_score": overall_score,
            "analytical_likelihood": overall_score,
            "priority": priority_label,
            "classification": classification_label,
            "label": f"{classification_label}",
            "scores": {
                "spatial_compatibility": spatial_pct,
                "temporal_compatibility": temporal_pct,
                "trajectory_compatibility": traj_pct,
                "wind_compatibility": wind_pct,
                "current_compatibility": current_pct,
                "overall": overall_score,
                # Backward compatibility aliases
                "proximity": spatial_pct,
                "temporal": temporal_pct,
                "trajectory": traj_pct,
                "behaviour": wind_pct,
                "vessel_relevance": current_pct,
            },
            "evidence": evidence,
            "counter_evidence": counter_evidence,
            "data_quality": data_quality,
            "confidence": round(0.70 + 0.20 * _clamp01(1.0 - gap_hours / 4.0), 2),
            "requires_human_investigation": True,
        })

    # Sort descending by composite score
    ranked.sort(key=lambda r: r["overall_score"], reverse=True)
    for idx, r in enumerate(ranked, start=1):
        r["rank"] = idx
        r["ranking"] = idx

    return {
        "ok": True,
        "ranked": ranked,
        "status": "Completed",
        "analytical_weights": w,
        "disclaimer": (
            "Attribution scores are objective analytical likelihood rankings for investigative prioritization. "
            "They do NOT establish legal responsibility or prove vessel discharge liability."
        ),
    }
