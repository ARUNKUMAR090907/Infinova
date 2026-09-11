from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]

# Load .env if present
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
INCIDENT_PATH = DATA_DIR / "incident.json"
SAR_PATH = DATA_DIR / "satellite" / "demo_sar.png"
AIS_PATH = DATA_DIR / "ais" / "demo_ais.csv"
OCEAN_PATH = DATA_DIR / "ocean" / "demo_ocean.csv"
DB_PATH = DATA_DIR / os.getenv("DB_NAME", "marineguard.db")

# Data mode: "hybrid" (default: live open data where possible, verified archive for AIS), "live", or "demo"
DATA_MODE = os.getenv("DATA_MODE", "hybrid").lower()
if DATA_MODE == "auto":
    DATA_MODE = "hybrid"

# CDSE Credentials and Endpoints
CDSE_USERNAME = os.getenv("CDSE_USERNAME", "")
CDSE_PASSWORD = os.getenv("CDSE_PASSWORD", "")
CDSE_CLIENT_ID = os.getenv("CDSE_CLIENT_ID", "")
CDSE_CLIENT_SECRET = os.getenv("CDSE_CLIENT_SECRET", "")
CDSE_STAC_URL = os.getenv("CDSE_STAC_URL", "https://catalogue.dataspace.copernicus.eu/stac")
CDSE_ODATA_URL = os.getenv("CDSE_ODATA_URL", "https://catalogue.dataspace.copernicus.eu/odata/v1")

# Open Scientific Services (Zero-credential live feeds)
OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/era5"

# VesselFinder Credentials
VESSELFINDER_API_KEY = os.getenv("VESSELFINDER_API_KEY", "")
VESSELFINDER_BASE_URL = os.getenv("VESSELFINDER_BASE_URL", "https://api.vesselfinder.com")

# Copernicus Marine Credentials
COPERNICUS_MARINE_USERNAME = os.getenv("COPERNICUS_MARINE_USERNAME", "")
COPERNICUS_MARINE_PASSWORD = os.getenv("COPERNICUS_MARINE_PASSWORD", "")

# CDS / ERA5 Credentials
CDS_API_URL = os.getenv("CDS_API_URL", "https://cds.climate.copernicus.eu/api")
CDS_API_KEY = os.getenv("CDS_API_KEY", "")

# AI / LLM Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
