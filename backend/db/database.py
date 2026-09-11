from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import DATA_DIR, DB_PATH, INCIDENT_PATH


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS incidents (
        incident_id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        severity TEXT,
        latitude REAL,
        longitude REAL,
        area_km2 REAL,
        detection_confidence REAL,
        satellite_scene TEXT,
        observation_time TEXT,
        created_at TEXT,
        metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS satellite_scenes (
        scene_id TEXT PRIMARY KEY,
        platform TEXT,
        product_type TEXT,
        sensing_time TEXT,
        bbox_json TEXT,
        geometry_json TEXT,
        acquisition_metadata_json TEXT,
        quicklook_url TEXT,
        provider TEXT,
        retrieved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS spill_detections (
        detection_id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT,
        confidence REAL,
        centroid_lat REAL,
        centroid_lon REAL,
        area_km2 REAL,
        perimeter_km REAL,
        length_km REAL,
        width_km REAL,
        polygon_json TEXT,
        mode TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS environmental_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT,
        timestamp TEXT,
        grid_json TEXT,
        wind_speed_mean REAL,
        current_speed_mean REAL,
        source TEXT
    );

    CREATE TABLE IF NOT EXISTS vessels (
        mmsi INTEGER PRIMARY KEY,
        imo INTEGER,
        name TEXT,
        vessel_type TEXT,
        destination TEXT,
        last_latitude REAL,
        last_longitude REAL,
        last_sog REAL,
        last_cog REAL,
        last_heading REAL,
        last_timestamp TEXT,
        metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS ais_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mmsi INTEGER,
        timestamp TEXT,
        latitude REAL,
        longitude REAL,
        sog REAL,
        cog REAL,
        heading REAL
    );

    CREATE TABLE IF NOT EXISTS hindcast_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT,
        origin_lat REAL,
        origin_lon REAL,
        origin_time TEXT,
        window_start TEXT,
        window_end TEXT,
        uncertainty_radius_km REAL,
        trajectory_json TEXT,
        geojson_text TEXT,
        confidence REAL,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS forecast_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT,
        horizons_json TEXT,
        trajectory_json TEXT,
        corridor_json TEXT,
        geojson_text TEXT,
        uncertainty_width_km REAL,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS candidate_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT,
        mmsi INTEGER,
        ranking INTEGER,
        score REAL,
        priority TEXT,
        evidence_json TEXT,
        scores_json TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
        report_id TEXT PRIMARY KEY,
        incident_id TEXT,
        filename TEXT,
        file_path TEXT,
        sections_json TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_health_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_name TEXT,
        status TEXT,
        latency_ms REAL,
        records_retrieved INTEGER,
        error_message TEXT,
        logged_at TEXT
    );
    """)

    conn.commit()

    # Seed initial demo incident if not present
    cur.execute("SELECT COUNT(*) FROM incidents WHERE incident_id = 'MG-2026-001'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO incidents (
                incident_id, title, status, severity, latitude, longitude, area_km2,
                detection_confidence, satellite_scene, observation_time, created_at, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "MG-2026-001",
            "Arabian Sea Offshore Spill Investigation (Demo Incident)",
            "UNDER INVESTIGATION",
            "HIGH",
            19.12,
            71.85,
            18.4,
            0.91,
            "S1A_IW_GRDH_1SDV_20260314T063000_DEMO",
            "2026-03-14T06:30:00Z",
            datetime.now(timezone.utc).isoformat(),
            json.dumps({"location_name": "Arabian Sea, west of Mumbai", "data_provenance": "SYNTHETIC DEMONSTRATION DATA"}),
        ))
        conn.commit()

    cur.execute("SELECT COUNT(*) FROM incidents WHERE incident_id = 'MG-LIVE-001'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            INSERT INTO incidents (
                incident_id, title, status, severity, latitude, longitude, area_km2,
                detection_confidence, satellite_scene, observation_time, created_at, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "MG-LIVE-001",
            "Arabian Sea Active Operational Incident (Live Feeds)",
            "UNDER INVESTIGATION",
            "HIGH",
            19.18,
            71.65,
            24.6,
            0.88,
            "S1A_IW_GRDH_LIVE_CDSE",
            datetime.now(timezone.utc).isoformat(),
            datetime.now(timezone.utc).isoformat(),
            json.dumps({"location_name": "Arabian Sea, Mumbai Offshore Corridor", "data_provenance": "LIVE SCIENTIFIC FEEDS (CDSE / CMEMS / ERA5 / AIS)", "live_feed": True}),
        ))
        conn.commit()

    conn.close()


# Initialize database schema immediately
init_db()
