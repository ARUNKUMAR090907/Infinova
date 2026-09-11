from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from backend.config import REPORTS_DIR

NAVY = colors.HexColor("#0b3d5c")
TEAL = colors.HexColor("#1a6b7a")


def generate_pdf(result: dict[str, Any], incident_id: str) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / f"{incident_id}_investigation.pdf"
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=NAVY, fontSize=16)
    h = ParagraphStyle("h", parent=styles["Heading2"], textColor=TEAL, fontSize=12, spaceBefore=8)
    body = ParagraphStyle("b", parent=styles["BodyText"], fontSize=9, leading=12)
    small = ParagraphStyle("s", parent=styles["BodyText"], fontSize=8, leading=11, textColor=colors.HexColor("#444"))

    det = result.get("detection", {})
    ch = result.get("characterization", {})
    hc = result.get("hindcast", {})
    fc = result.get("forecast", {})
    ais = result.get("ais", {})
    attr = result.get("attribution", {})
    inc = result.get("incident", {})
    ranked = attr.get("ranked") or []

    pts = ", ".join(
        f"+{p.get('hours')}h ({p.get('lat')}, {p.get('lng')})" for p in (fc.get("forecast_points") or [])[:8]
    )

    story = [
        Paragraph("INFINOVA — Investigation Report", title),
        Paragraph("SYNTHETIC DEMONSTRATION DATA — not real-world observations.", small),
        Spacer(1, 4 * mm),
        Paragraph("1. Incident information", h),
        Paragraph(
            f"Incident ID: {inc.get('incident_id', incident_id)}<br/>"
            f"Observation time: {inc.get('observation_time')}<br/>"
            f"Location: {inc.get('scene_center')}<br/>"
            f"Sensor: {inc.get('sensor', 'Sentinel-1 SAR (demo)')}<br/>"
            f"Status: {result.get('status')}",
            body,
        ),
        Paragraph("2. Satellite observation", h),
        Paragraph(
            f"Image: {det.get('image_name')}<br/>Detection mode: {det.get('mode')}<br/>{det.get('detection_note')}",
            body,
        ),
        Paragraph("3. Spill detection", h),
        Paragraph(f"Confidence: {det.get('confidence')}%<br/>Mask pixels: {det.get('mask_pixel_count')}", body),
        Paragraph("4. Spill geometry", h),
        Paragraph(
            f"Area {ch.get('area_km2')} km² · Length {ch.get('length_km')} km · "
            f"Width {ch.get('width_km')} km · Perimeter {ch.get('perimeter_km')} km · "
            f"Centroid {ch.get('centroid')} · Shape {ch.get('shape')}",
            body,
        ),
        Paragraph("5. Probable origin", h),
        Paragraph(
            f"{hc.get('probable_origin')}<br/>Time window: {hc.get('origin_time_window')}<br/>"
            f"Uncertainty radius: {hc.get('uncertainty_radius_km')} km<br/>{hc.get('model_disclaimer')}",
            body,
        ),
        Paragraph("6. Hindcast result", h),
        Paragraph(
            f"Backward points: {len((hc.get('backward_trajectory') or []))}. Wind {hc.get('wind')}. Current {hc.get('current')}.",
            body,
        ),
        Paragraph("7. Forecast", h),
        Paragraph(pts or "No forecast points.", body),
        Paragraph("8. AIS traffic analysis", h),
        Paragraph(
            f"Total vessels {ais.get('total_vessels')} · Spatial {ais.get('spatial_candidates')} · "
            f"Temporal {ais.get('temporal_candidates')} · Final {ais.get('final_candidates')}",
            body,
        ),
        Paragraph("9. Candidate vessel ranking", h),
    ]

    table_data = [["Rank", "MMSI", "Score", "Priority"]]
    for v in ranked:
        table_data.append(
            [str(v.get("rank")), str(v.get("mmsi")), str(v.get("scores", {}).get("overall")), v.get("priority")]
        )
    if len(table_data) == 1:
        table_data.append(["—", "insufficient vessel data", "—", "—"])
    tbl = Table(table_data, colWidths=[25 * mm, 50 * mm, 30 * mm, 30 * mm])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.Color(0.93, 0.96, 0.97)]),
            ]
        )
    )
    story.append(tbl)

    story.append(Paragraph("10. Evidence", h))
    if ranked:
        top = ranked[0]
        story.append(
            Paragraph(
                f"Highest-priority candidate MMSI {top.get('mmsi')} ({top.get('role_language')}).",
                body,
            )
        )
        for e in top.get("evidence") or []:
            story.append(Paragraph(f"• {e}", body))
    else:
        story.append(Paragraph("Insufficient vessel data for ranking.", body))

    story.extend(
        [
            Paragraph("11. Confidence", h),
            Paragraph(
                f"Detection {det.get('confidence')}% · Characterisation {ch.get('confidence')}% · "
                f"Drift uncertainty {hc.get('uncertainty_radius_km')} km.",
                body,
            ),
            Paragraph("12. Data gaps", h),
            Paragraph(
                "AIS may contain gaps or spoofed/missing signals. Satellite detection can include false positives. "
                "Oceanographic inputs are a single-point synthetic field.",
                body,
            ),
            Paragraph("13. Responsible-AI disclaimer", h),
            Paragraph(
                "Attribution is probabilistic. Results require human validation. "
                "This system must not be used as the sole basis for legal enforcement. "
                "The ranking prioritises vessels for investigation and does not establish definitive legal responsibility.",
                body,
            ),
            Spacer(1, 6 * mm),
            Paragraph(
                f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
                "INFINOVA prototype (SIH 2026 PS 26143).",
                small,
            ),
        ]
    )

    doc = SimpleDocTemplate(str(path), pagesize=A4, title="INFINOVA Investigation Report")
    doc.build(story)
    return path
