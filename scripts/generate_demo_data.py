from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SAT = ROOT / "data" / "satellite"
AIS = ROOT / "data" / "ais"
OCEAN = ROOT / "data" / "ocean"
INC = ROOT / "data" / "incidents"


def write_sar() -> tuple[int, int]:
    SAT.mkdir(parents=True, exist_ok=True)
    h, w = 512, 640
    rng = np.random.default_rng(26143)
    base = rng.normal(148, 16, (h, w)).astype(np.float32)
    # Speckle-ish multiplicative noise
    speckle = rng.lognormal(0, 0.12, (h, w)).astype(np.float32)
    img = np.clip(base * speckle, 0, 255)

    # Dark elongated slick (oil analogue on SAR)
    center = (330, 250)
    axes = (118, 22)
    cv2.ellipse(img, center, axes, 28, 0, 360, 48, -1)
    cv2.ellipse(img, center, (108, 14), 28, 0, 360, 38, -1)

    # Faint look-alike clutter (ship wake-ish)
    cv2.line(img, (80, 400), (160, 430), 170, 2)

    img_u8 = np.clip(img, 0, 255).astype(np.uint8)
    png_path = SAT / "demo_sar.png"
    Image.fromarray(img_u8, mode="L").save(png_path)

    tif_written = False
    try:
        import rasterio
        from rasterio.transform import from_bounds

        bounds = (69.20, 19.90, 69.70, 20.35)
        transform = from_bounds(*bounds, w, h)
        tif_path = SAT / "demo_sar.tif"
        with rasterio.open(
            tif_path,
            "w",
            driver="GTiff",
            height=h,
            width=w,
            count=1,
            dtype="uint8",
            crs="EPSG:4326",
            transform=transform,
        ) as dst:
            dst.write(img_u8, 1)
        tif_written = True
    except Exception as exc:
        print(f"GeoTIFF skipped ({exc}). PNG preview is sufficient for the demo.")

    print(f"Wrote {png_path}" + (" and GeoTIFF" if tif_written else ""))
    return h, w


def write_ocean() -> None:
    OCEAN.mkdir(parents=True, exist_ok=True)
    path = OCEAN / "demo_ocean.csv"
    # Arabian Sea demo: moderate NW wind, weak NE current
    rows = [
        {
            "timestamp": "2026-03-14T06:00:00Z",
            "latitude": 20.12,
            "longitude": 69.42,
            "wind_u": 3.4,
            "wind_v": -4.1,
            "current_u": 0.22,
            "current_v": 0.11,
        },
        {
            "timestamp": "2026-03-14T09:00:00Z",
            "latitude": 20.12,
            "longitude": 69.42,
            "wind_u": 3.6,
            "wind_v": -3.8,
            "current_u": 0.24,
            "current_v": 0.10,
        },
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {path}")


def write_ais() -> dict[str, str]:
    AIS.mkdir(parents=True, exist_ok=True)
    path = AIS / "demo_ais.csv"
    names = {
        "419001111": "MT ARABIAN STAR (tanker)",
        "419002222": "MV KUTCH TRADER (cargo)",
        "419003333": "FV DWARKA PEARL (fishing)",
        "419004444": "MV SAURASHTRA EXPRESS (cargo)",
        "419005555": "MT WESTERN CURRENT (tanker, distant)",
        "419006666": "FV PORBANDAR 12 (fishing, far)",
    }

    def iso(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    t0 = datetime(2026, 3, 14, 1, 0, tzinfo=timezone.utc)
    rows: list[dict] = []

    def add_track(mmsi: str, points: list[tuple[int, float, float, float, float]]) -> None:
        for minutes, lat, lon, sog, cog in points:
            rows.append(
                {
                    "mmsi": mmsi,
                    "timestamp": iso(t0 + timedelta(minutes=minutes)),
                    "latitude": round(lat, 5),
                    "longitude": round(lon, 5),
                    "sog": sog,
                    "cog": cog,
                }
            )

    # Highest-priority candidate: slow near probable origin ~02:30 (90 min after t0)
    add_track(
        "419001111",
        [
            (30, 20.05, 69.28, 8.2, 55),
            (50, 20.07, 69.31, 6.1, 58),
            (70, 20.085, 69.335, 3.4, 62),
            (90, 20.095, 69.355, 2.1, 70),  # near origin, slow
            (110, 20.11, 69.38, 4.8, 72),
            (140, 20.13, 69.42, 7.5, 75),
            (180, 20.16, 69.48, 9.0, 78),
            (240, 20.20, 69.55, 10.2, 80),
        ],
    )
    # Medium: nearby later
    add_track(
        "419002222",
        [
            (40, 20.18, 69.30, 12.0, 110),
            (80, 20.14, 69.36, 11.4, 118),
            (120, 20.10, 69.41, 11.8, 122),
            (160, 20.06, 69.47, 12.1, 125),
            (220, 20.02, 69.54, 12.4, 128),
        ],
    )
    # Medium: fishing loiter, spatial but weaker temporal alignment at origin
    add_track(
        "419003333",
        [
            (20, 20.16, 69.50, 3.2, 200),
            (60, 20.14, 69.48, 2.8, 240),
            (100, 20.15, 69.46, 2.4, 20),
            (150, 20.17, 69.47, 3.0, 90),
            (200, 20.16, 69.49, 2.6, 180),
            (260, 20.14, 69.51, 3.1, 210),
        ],
    )
    # Low: transits the scene after observation
    add_track(
        "419004444",
        [
            (300, 19.95, 69.25, 14.0, 45),
            (340, 20.02, 69.35, 14.2, 48),
            (380, 20.10, 69.45, 14.1, 50),
            (420, 20.18, 69.55, 14.3, 52),
        ],
    )
    # Distant tanker — filtered spatially
    add_track(
        "419005555",
        [
            (60, 20.55, 70.10, 11.0, 270),
            (120, 20.55, 70.00, 11.1, 270),
            (180, 20.55, 69.90, 11.0, 268),
        ],
    )
    # Far fishing
    add_track(
        "419006666",
        [
            (90, 19.70, 69.10, 4.0, 10),
            (150, 19.74, 69.12, 4.2, 12),
            (210, 19.78, 69.14, 3.8, 15),
        ],
    )

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["mmsi", "timestamp", "latitude", "longitude", "sog", "cog"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {path} ({len(rows)} positions)")
    return names


def write_incident(names: dict[str, str]) -> None:
    INC.mkdir(parents=True, exist_ok=True)
    payload = {
        "incident_id": "MG-SIH-26143-DEMO-001",
        "title": "Arabian Sea SAR anomaly — demonstration incident",
        "location_name": "Arabian Sea, west of Gujarat (synthetic scene)",
        "observation_time": "2026-03-14T08:30:00Z",
        "sensor": "Sentinel-1 IW GRD analogue (synthetic)",
        "polarization": "VV",
        "data_provenance": "SYNTHETIC DEMONSTRATION DATA",
        "bounds": {
            "min_lon": 69.20,
            "min_lat": 19.90,
            "max_lon": 69.70,
            "max_lat": 20.35,
        },
        "sar_relative_path": "data/satellite/demo_sar.png",
        "sar_png_path": "data/satellite/demo_sar.png",
        "ais_relative_path": "data/ais/demo_ais.csv",
        "ocean_relative_path": "data/ocean/demo_ocean.csv",
        "vessel_names": names,
        "notes": "All fields are synthetic for SIH 2026 Problem Statement 26143 demonstration.",
    }
    path = INC / "demo_incident.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {path}")


def main() -> None:
    write_sar()
    write_ocean()
    names = write_ais()
    write_incident(names)
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "ml" / "weights").mkdir(parents=True, exist_ok=True)
    print("Demo assets ready.")


if __name__ == "__main__":
    main()
