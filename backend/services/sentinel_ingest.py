"""Optional Sentinel-1 ingestion (NOT used by the SIH demo).

The judging demo loads ``data/satellite/demo_sar.png`` only. Live Copernicus
Data Space access needs operator credentials, network, and product licensing —
none of which should be required on stage.

If you later enable real SAR:

1. Register at the Copernicus Data Space Ecosystem.
2. Store credentials in environment variables (never commit them):
   ``CDSE_USERNAME``, ``CDSE_PASSWORD`` or an OAuth client id/secret.
3. Search Sentinel-1 GRD (IW, VV/VH) over the incident AOI/time.
4. Download, calibrate, speckle-filter, and geocode, then pass the local path
   into ``POST /api/detect`` / investigation via ``incident.sar_image``.

This module is a documented extension point, not a runtime dependency.
"""

from __future__ import annotations

from pathlib import Path


class Sentinel1IngestNotConfigured(RuntimeError):
    pass


def ingest_sentinel1_scene(
    bbox: tuple[float, float, float, float],
    start_iso: str,
    end_iso: str,
    out_dir: Path | None = None,
) -> Path:
    raise Sentinel1IngestNotConfigured(
        "Live Sentinel-1 ingest is disabled for the offline SIH demo. "
        "Use data/satellite/demo_sar.png, or implement CDSE download with env credentials."
    )
