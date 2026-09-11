from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import DATA_DIR, REPORTS_DIR
from backend.db.database import init_db
from backend.routes import (
    ais,
    attribution,
    characterization,
    dashboard,
    detection,
    drift,
    environment,
    health,
    incidents,
    report,
    satellite,
)
from backend.schemas import InvestigationRequest
from backend.services.pipeline import run_investigation


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    sar = DATA_DIR / "satellite" / "demo_sar.png"
    sar.parent.mkdir(parents=True, exist_ok=True)
    if not sar.exists():
        sys.path.insert(0, str(ROOT))
        from data.generate_demo_assets import generate_sar
        generate_sar(sar)
    yield


app = FastAPI(
    title="INFINOVA",
    description="Satellite Oil Spill Detection, Drift Prediction & AIS Attribution Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all feature routers under /api
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(satellite.router, prefix="/api", tags=["satellite"])
app.include_router(environment.router, prefix="/api", tags=["environment"])
app.include_router(ais.router, prefix="/api", tags=["ais"])
app.include_router(attribution.router, prefix="/api", tags=["attribution"])
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(detection.router, prefix="/api", tags=["detection"])
app.include_router(characterization.router, prefix="/api", tags=["characterization"])
app.include_router(drift.router, prefix="/api", tags=["drift"])
app.include_router(report.router, prefix="/api", tags=["report"])

DATA_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/data", StaticFiles(directory=str(DATA_DIR)), name="data")


@app.post("/api/investigation")
@app.post("/api/investigation/run")
def investigation(req: InvestigationRequest | None = None):
    try:
        incident_path = req.incident_path if req else None
        return run_investigation(incident_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/investigation/{incident_id}")
def get_investigation_by_id(incident_id: str):
    try:
        return run_investigation()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/report/{incident_id}")
def get_report_by_id(incident_id: str):
    try:
        from backend.services.ai_report import build_structured_investigation_report
        inv = run_investigation()
        return build_structured_investigation_report(inv)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/report/download/{filename}")
def download_report(filename: str):
    safe = Path(filename).name
    path = REPORTS_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report file not found.")
    return FileResponse(path, media_type="application/pdf", filename=safe)


