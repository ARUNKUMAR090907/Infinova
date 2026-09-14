#!/usr/bin/env python3
"""
INFINOVA - Live Open Data Ingestion Pipeline
Queries official open APIs: Copernicus CDSE, Open-Meteo Marine, Open-Meteo ECMWF.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.data_fetcher import fetch_all_live_data


def main():
    parser = argparse.ArgumentParser(description="Fetch live data across all 4 INFINOVAproviders.")
    parser.add_argument("--source", choices=["all", "cdse", "marine", "weather", "vesselfinder"], default="all")
    parser.add_argument("--aoi", nargs=4, type=float, default=[71.50, 18.80, 72.20, 19.45],
                        help="AOI bbox: min_lon min_lat max_lon max_lat")
    parser.add_argument("--save-db", action="store_true", help="Persist fetched feeds to SQLite")
    parser.add_argument(
        "--out-json",
        type=str,
        default=None,
        help="Optional path to save JSON execution summary",
    )
    args = parser.parse_args()
    bbox = tuple(args.aoi)
    print("      INFINOVA - Multi-Provider Live Data Acquisition Pipeline          ")
    print("================================================================================")
    print(f"Target Bounding Box: {bbox} (Arabian Sea / Mumbai Offshore)")
    print("Querying 4 Scientific Providers...")
    print(" - 1. Copernicus Data Space Ecosystem (CDSE) [Sentinel-1 SAR]")
    print(" - 2. Copernicus Marine Service (CMEMS) [Surface Ocean Currents]")
    print(" - 3. Copernicus Climate Data Store (CDS/ERA5) [10m Wind Vectors]")
    print(" - 4. VesselFinder AIS [Maritime Shipping Traffic Feed]")
    print("--------------------------------------------------------------------------------")

    result = fetch_all_live_data(bbox=bbox)

    print("\nLive Ingestion Complete!")
    print(f"Total Execution Latency: {result['total_latency_ms']} ms")
    print(f"Timestamp: {result['timestamp']}\n")

    print(f"{'Provider':<48} | {'Status':<12} | {'Records':<8} | {'Latency':<10}")
    print("-" * 84)
    for key, p in result["providers"].items():
        print(f"{p['name']:<48} | {p['status']:<12} | {p['records']:<8} | {p['latency_ms']:<8} ms")

    print("-" * 84)
    print(f"Environmental Forcing CSV: {result['environmental_forcing_csv']}")
    print(f"Live Incident File:        {result['live_incident_file']}")
    print("================================================================================\n")

    if args.out_json:
        with open(args.out_json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        print(f"Summary written to {args.out_json}")


if __name__ == "__main__":
    main()
