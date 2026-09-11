from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import REPORTS_DIR
from backend.schemas import ReportRequest
from backend.services.envelope import with_envelope
from backend.services.report_builder import generate_pdf

router = APIRouter()


@router.post("/report/generate")
def report_generate(req: ReportRequest):
    try:
        return with_envelope(generate_pdf(req.investigation))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/report/download/{filename}")
def report_download(filename: str):
    from pathlib import Path

    safe = Path(filename).name
    path = REPORTS_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")
    return FileResponse(path, media_type="application/pdf", filename=safe)
