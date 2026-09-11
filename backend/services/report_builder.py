from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from backend.config import REPORTS_DIR


NAVY = colors.HexColor("#0b1f33")
TEAL = colors.HexColor("#1f6f8b")
MUTED = colors.HexColor("#445566")


def generate_pdf(investigation: dict) -> dict:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    incident = investigation.get("incident") or {}
    iid = incident.get("incident_id", "unknown")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = REPORTS_DIR / f"{iid}_{stamp}.pdf"

    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=NAVY, fontSize=16, spaceAfter=6)
    h = ParagraphStyle("h", parent=styles["Heading2"], textColor=TEAL, fontSize=12, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("b", parent=styles["BodyText"], fontSize=9, leading=12, textColor=MUTED)
    warn = ParagraphStyle("w", parent=styles["BodyText"], fontSize=9, leading=12, textColor=colors.HexColor("#8a3b12"))

    story = []
    story.append(Paragraph("INFINOVA — Investigation Report", title))
    story.append(Paragraph("SYNTHETIC DEMONSTRATION DATA — not real-world observations.", warn))
    story.append(Spacer(1, 4))

    det = investigation.get("detection") or {}
    char = investigation.get("characterization") or {}
    hc = investigation.get("hindcast") or {}
    fc = investigation.get("forecast") or {}
    ais = investigation.get("ais") or {}
    attr = investigation.get("attribution") or {}
    origin = hc.get("probable_origin") or {}
    centroid = char.get("centroid") or {}

    def kv_table(rows):
        data = [["Field", "Value"]] + rows
        t = Table(data, colWidths=[55 * mm, 120 * mm])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cfd8dc")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f7fafc")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return t

    story.append(Paragraph("1. Incident information", h))
    story.append(
        kv_table(
            [
                ["Incident ID", str(iid)],
                ["Title", str(incident.get("title", ""))],
                ["Location", str(incident.get("location_name", ""))],
                ["Observation time", str(incident.get("observation_time", ""))],
                ["Provenance", "SYNTHETIC DEMONSTRATION DATA"],
            ]
        )
    )

    story.append(Paragraph("2. Satellite observation", h))
    story.append(
        Paragraph(
            f"SAR scene associated with this incident. Detection mode: <b>{det.get('mode_label', 'n/a')}</b>. {det.get('disclaimer', '')}",
            body,
        )
    )

    story.append(Paragraph("3. Spill detection", h))
    story.append(
        kv_table(
            [
                ["Mode", str(det.get("mode_label", ""))],
                ["Confidence", f"{round(float(det.get('confidence', 0)) * 100, 1)}%"],
                ["Status", str(det.get("status", ""))],
            ]
        )
    )

    story.append(Paragraph("4. Spill geometry", h))
    story.append(
        kv_table(
            [
                ["Area", f"{char.get('area_km2', 'n/a')} km²"],
                ["Length", f"{char.get('length_km', 'n/a')} km"],
                ["Width", f"{char.get('width_km', 'n/a')} km"],
                ["Perimeter", f"{char.get('perimeter_km', 'n/a')} km"],
                ["Centroid", f"{centroid.get('latitude')}, {centroid.get('longitude')}"],
                ["Shape", str(char.get("shape_characteristics", ""))],
            ]
        )
    )

    story.append(Paragraph("5. Probable origin", h))
    story.append(
        kv_table(
            [
                ["Latitude", str(origin.get("latitude"))],
                ["Longitude", str(origin.get("longitude"))],
                ["Estimated origin time", str(origin.get("time"))],
                ["Window", f"{(hc.get('origin_time_window') or {}).get('start')} → {(hc.get('origin_time_window') or {}).get('end')}"],
                ["Uncertainty radius", f"{hc.get('uncertainty_radius_km')} km"],
            ]
        )
    )
    story.append(Paragraph(str(hc.get("disclaimer", "")), body))

    story.append(Paragraph("6. Hindcast result", h))
    story.append(Paragraph(f"Backward trajectory points: {len(hc.get('trajectory') or [])}. Model: {hc.get('model')}.", body))

    story.append(Paragraph("7. Forecast", h))
    pts = fc.get("points") or []
    rows = [["Lead time", "Latitude", "Longitude"]]
    for p in pts:
        rows.append([f"+{p.get('hours_ahead')} h", str(p.get("latitude")), str(p.get("longitude"))])
    t = Table(rows, colWidths=[40 * mm, 67 * mm, 68 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TEAL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cfd8dc")),
            ]
        )
    )
    story.append(t)
    story.append(Paragraph(str(fc.get("disclaimer", "")), body))

    story.append(Paragraph("8. AIS traffic analysis", h))
    story.append(
        kv_table(
            [
                ["Total vessels", str(ais.get("total_vessels"))],
                ["Spatial candidates", str(ais.get("spatial_candidates"))],
                ["Temporal candidates", str(ais.get("temporal_candidates"))],
                ["Final candidates", str(ais.get("final_candidates"))],
            ]
        )
    )

    story.append(Paragraph("9. Candidate vessel ranking", h))
    ranked = attr.get("ranked") or []
    rrows = [["Rank", "MMSI", "Score", "Priority"]]
    for v in ranked:
        rrows.append([str(v.get("rank")), str(v.get("mmsi")), str(v.get("score")), str(v.get("priority"))])
    rt = Table(rrows, colWidths=[25 * mm, 50 * mm, 50 * mm, 50 * mm])
    rt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cfd8dc")),
            ]
        )
    )
    story.append(rt)

    story.append(Paragraph("10. Evidence", h))
    for v in ranked[:5]:
        ev = "<br/>".join(f"• {e}" for e in (v.get("evidence") or []))
        story.append(Paragraph(f"<b>{v.get('name')} ({v.get('mmsi')})</b> — {v.get('label')}<br/>{ev}", body))

    story.append(Paragraph("11. Confidence", h))
    story.append(
        Paragraph(
            f"Detection confidence {round(float(det.get('confidence', 0))*100,1)}%. "
            f"Drift uncertainty radius {hc.get('uncertainty_radius_km')} km. "
            f"Forecast corridor width {fc.get('uncertainty_width_km')} km.",
            body,
        )
    )

    story.append(Paragraph("12. Data gaps", h))
    gaps = [
        "Satellite detection may include false positives, especially in prototype/demo mode.",
        "AIS coverage may be gapped, delayed, or spoofed.",
        "Ocean wind/current fields are sparse demonstration vectors, not a circulation model.",
    ]
    for v in ranked:
        for g in v.get("data_gaps") or []:
            gaps.append(f"{v.get('mmsi')}: {g}")
    story.append(Paragraph("<br/>".join(f"• {g}" for g in gaps), body))

    story.append(Paragraph("13. Responsible-AI disclaimer", h))
    story.append(
        Paragraph(
            "This system prioritises vessels for investigation and does not establish definitive legal responsibility. "
            "The highest-ranked vessel is a highest-priority candidate only. Results require human validation and "
            "must not be used as the sole basis for legal enforcement.",
            warn,
        )
    )

    doc = SimpleDocTemplate(str(path), pagesize=A4, title=f"INFINOVA {iid}")
    doc.build(story)
    return {
        "ok": True,
        "path": str(path),
        "filename": path.name,
        "download_url": f"/api/report/download/{path.name}",
    }
