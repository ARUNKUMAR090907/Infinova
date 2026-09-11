from __future__ import annotations

from backend.services import ais_processor, characterization, forecast, hindcast, segmentation, vessel_scoring
from backend.services.envelope import with_envelope
from backend.services.incident import load_incident
from backend.services.sources import ais_source, ocean_source, satellite_source


def run_investigation(incident_path: str | None = None) -> dict:
    timeline = []
    errors = []
    incident = load_incident(incident_path)
    timeline.append({"step": "Satellite observation", "status": "Completed", "detail": incident["observation_time"]})

    detection = None
    try:
        detection = segmentation.detect_spill(str(satellite_source.path(incident)))
        timeline.append({"step": "Detection", "status": "Completed", "detail": detection["mode_label"]})
    except Exception as exc:
        errors.append(str(exc))
        timeline.append({"step": "Detection", "status": "Error", "detail": str(exc)})
        return with_envelope(
            {
                "ok": False,
                "demo_mode": True,
                "incident": incident,
                "errors": errors,
                "timeline": timeline,
                "status": "Error",
            },
            warnings=errors,
            success=False,
        )

    char = characterization.characterize_mask(
        detection["binary_mask"],
        georef=detection.get("georef") or incident.get("georef"),
        confidence=detection.get("confidence", 0),
    )
    char["estimated_age_hours"] = incident.get("estimated_spill_age_hours", 4.5)
    timeline.append({"step": "Characterisation", "status": "Completed", "detail": f"{char['area_km2']} km²"})

    hc = hindcast.run_hindcast(
        centroid=char["centroid"],
        observation_time=incident["observation_time"],
        ocean_path=str(ocean_source.path(incident)),
        estimated_age_hours=char["estimated_age_hours"],
    )
    timeline.append({"step": "Hindcast", "status": "Completed", "detail": "Simplified prototype drift"})
    timeline.append(
        {
            "step": "Origin estimation",
            "status": "Completed",
            "detail": hc["origin_time_window"]["start"] + " → " + hc["origin_time_window"]["end"],
        }
    )

    fc = forecast.run_forecast(
        centroid=char["centroid"],
        observation_time=incident["observation_time"],
        ocean_path=str(ocean_source.path(incident)),
    )
    timeline.append({"step": "Forecast", "status": "Completed", "detail": "+12 h corridor"})

    ais = ais_processor.analyze_ais(
        origin=hc["probable_origin"],
        origin_time=hc["probable_origin"]["time"],
        ais_path=str(ais_source.path(incident)),
    )
    timeline.append(
        {
            "step": "AIS filtering",
            "status": ais["status"],
            "detail": f"{ais['final_candidates']} final candidates",
        }
    )

    pool = ais["candidates"] or ais.get("fallback_candidates") or []
    attr = vessel_scoring.score_vessels(pool, hc["probable_origin"], hc["probable_origin"]["time"])
    timeline.append(
        {
            "step": "Attribution",
            "status": attr["status"],
            "detail": f"{len(attr['ranked'])} ranked vessels",
        }
    )

    # Drop bulky mask from API payload; keep previews
    detection_out = {k: v for k, v in detection.items() if k != "binary_mask"}

    warnings = []
    if ais.get("warning"):
        warnings.append(ais["warning"])
    if detection_out.get("mode") != "ml_model":
        warnings.append("Prototype Detection — trained model weights unavailable.")

    payload = {
        "ok": True,
        "demo_mode": True,
        "data_provenance": "SYNTHETIC DEMONSTRATION DATA",
        "status": "Completed",
        "incident": incident,
        "detection": detection_out,
        "characterization": char,
        "hindcast": hc,
        "forecast": fc,
        "ais": {
            "total_vessels": ais["total_vessels"],
            "vessels_considered": ais.get("vessels_considered", ais["total_vessels"]),
            "vessels_filtered": ais.get("vessels_filtered"),
            "spatial_candidates": ais["spatial_candidates"],
            "temporal_candidates": ais["temporal_candidates"],
            "final_candidates": ais["final_candidates"],
            "vessels": ais["vessels"],
            "warning": ais.get("warning"),
            "data_provenance": ais["data_provenance"],
            "ais_label": ais.get("ais_label", "Synthetic demonstration AIS"),
        },
        "attribution": attr,
        "timeline": timeline,
        "errors": errors,
        "uncertainty": {
            "detection_confidence": detection_out.get("confidence"),
            "origin_radius_km": hc.get("uncertainty_radius_km"),
            "forecast_corridor_km": fc.get("uncertainty_width_km"),
            "attribution": "Scores are relative ranks among filtered vessels, not probabilities of guilt.",
        },
        "responsible_ai": {
            "attribution_probabilistic": True,
            "false_positives_possible": True,
            "ais_gaps_or_spoofing_possible": True,
            "ocean_uncertainty": True,
            "requires_human_validation": True,
            "not_legal_enforcement": True,
            "human_in_the_loop": (
                "INFINOVA provides decision support and prioritizes investigation candidates. "
                "Final attribution requires human review and corroborating evidence."
            ),
            "privacy": (
                "AIS identifiers (MMSI, vessel name) are used only for investigation support "
                "and are not personal identities."
            ),
            "bias_and_error_sources": [
                "SAR look-alikes (low wind, biogenic slicks, rain cells, ship wakes).",
                "Weather and sea-state effects on SAR contrast.",
                "Incomplete, gapped, or spoofed AIS transmissions.",
                "Detector bias when trained weights are missing (prototype fallback).",
                "Sparse or synthetic oceanographic forcing.",
            ],
            "statements": [
                "INFINOVA provides decision support and prioritizes investigation candidates. Final attribution requires human review and corroborating evidence.",
                "Detection, origin estimation, forecast, and vessel ranking are separate steps — correlation is not attribution.",
                "Satellite detection can contain false positives (look-alikes).",
                "AIS may contain gaps, delays, or spoofed/missing signals.",
                "Oceanographic inputs are sparse demonstration vectors, not a circulation model.",
                "Results must not be used as the sole basis for legal enforcement.",
                "Included demo uses SYNTHETIC DEMONSTRATION DATA for SAR analogue, AIS, and ocean fields.",
            ],
        },
    }
    return with_envelope(payload, warnings=warnings)
