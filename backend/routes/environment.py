from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from backend.providers.registry import registry
from backend.services.envelope import with_envelope
from backend.services.environmental import build_environmental_grid

router = APIRouter()


@router.get("/environment/wind")
def get_wind(
    min_lon: float = Query(55.0, description="West longitude"),
    min_lat: float = Query(-5.0, description="South latitude"),
    max_lon: float = Query(92.0, description="East longitude"),
    max_lat: float = Query(26.0, description="North latitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
    resolution: float = Query(0.50, description="Grid resolution in degrees"),
):
    try:
        bbox = (min_lon, min_lat, max_lon, max_lat)
        records = registry.weather.get_wind(bbox=bbox, timestamp=timestamp, resolution=resolution)
        health = registry.weather.get_health()
        status_label = "LIVE" if health.get("status") == "ONLINE" else ("SIMULATED" if registry.get_mode() == "demo" else "HISTORICAL")

        # Guarantee normalized structure per SIH/User specification
        normalized = []
        for r in records:
            spd = float(r.get("speed_ms") or r.get("windSpeed") or r.get("speed") or 0.0)
            direct = float(r.get("direction_from") or r.get("windDirection") or r.get("direction") or 0.0)
            u = float(r.get("u_wind") or r.get("uComponent") or 0.0)
            v = float(r.get("v_wind") or r.get("vComponent") or 0.0)
            lat = float(r.get("latitude") or r.get("lat") or 0.0)
            lon = float(r.get("longitude") or r.get("lon") or 0.0)
            ts = r.get("timestamp") or timestamp

            normalized.append({
                "source": "Copernicus CDS / ERA5",
                "timestamp": ts,
                "latitude": lat,
                "longitude": lon,
                "lat": lat,
                "lon": lon,
                "windSpeed": spd,
                "wind_speed_ms": spd,
                "speed": spd,
                "windDirection": direct,
                "wind_direction": direct,
                "direction": direct,
                "uComponent": u,
                "vComponent": v,
                "u_wind": u,
                "v_wind": v,
                "status": status_label,
                "data_mode": status_label,
            })

        return with_envelope({
            "bbox": list(bbox),
            "timestamp": timestamp,
            "resolution": resolution,
            "vector_count": len(normalized),
            "vectors": normalized,
            "source": "Copernicus CDS / ERA5",
            "provider": health.get("provider", "Copernicus CDS"),
            "status": status_label,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/environment/currents")
def get_currents(
    min_lon: float = Query(55.0, description="West longitude"),
    min_lat: float = Query(-5.0, description="South latitude"),
    max_lon: float = Query(92.0, description="East longitude"),
    max_lat: float = Query(26.0, description="North latitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
    depth: float = Query(0.0, description="Depth in meters (0 for surface)"),
    resolution: float = Query(0.50, description="Grid resolution in degrees"),
    provider: str = Query("incois", description="Currents provider: 'incois' or 'cmems'"),
):
    try:
        bbox = (min_lon, min_lat, max_lon, max_lat)
        if provider.lower() == "cmems":
            records = registry.ocean.get_currents(bbox=bbox, timestamp=timestamp, depth=depth, resolution=resolution)
            health = registry.ocean.get_health()
            source_name = "Copernicus Marine Service (CMEMS)"
        else:
            records = registry.incois_ocean.get_currents(bbox=bbox, timestamp=timestamp, depth=depth, resolution=resolution)
            health = registry.incois_ocean.get_health()
            source_name = "INCOIS"

        status_label = "LIVE" if health.get("status") == "ONLINE" else ("SIMULATED" if registry.get_mode() == "demo" else "CACHED")

        # Guarantee normalized structure per specification
        normalized = []
        for r in records:
            spd = float(r.get("current_speed") or r.get("currentSpeed") or r.get("speed") or 0.0)
            direct = float(r.get("current_direction") or r.get("currentDirection") or r.get("direction") or 0.0)
            u = float(r.get("u_current") or r.get("uComponent") or 0.0)
            v = float(r.get("v_current") or r.get("vComponent") or 0.0)
            lat = float(r.get("latitude") or r.get("lat") or 0.0)
            lon = float(r.get("longitude") or r.get("lon") or 0.0)
            ts = r.get("timestamp") or timestamp

            normalized.append({
                "source": source_name,
                "timestamp": ts,
                "latitude": lat,
                "longitude": lon,
                "lat": lat,
                "lon": lon,
                "currentSpeed": spd,
                "current_speed": spd,
                "speed": spd,
                "currentDirection": direct,
                "current_direction": direct,
                "direction": direct,
                "uComponent": u,
                "vComponent": v,
                "u_current": u,
                "v_current": v,
                "depth_m": depth,
                "status": status_label,
                "data_mode": status_label,
            })

        return with_envelope({
            "bbox": list(bbox),
            "timestamp": timestamp,
            "depth_m": depth,
            "resolution": resolution,
            "vector_count": len(normalized),
            "vectors": normalized,
            "source": source_name,
            "provider": health.get("provider", source_name),
            "status": status_label,
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/environment/grid")
def get_environmental_grid(
    min_lon: float = Query(71.4, description="West longitude"),
    min_lat: float = Query(18.7, description="South latitude"),
    max_lon: float = Query(72.3, description="East longitude"),
    max_lat: float = Query(19.5, description="North latitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
    resolution: float = Query(0.15, description="Grid resolution in degrees"),
    windage_factor: float = Query(0.03, description="Leeway windage factor"),
):
    try:
        bbox = (min_lon, min_lat, max_lon, max_lat)
        grid_data = build_environmental_grid(
            bbox=bbox,
            timestamp=timestamp,
            resolution=resolution,
            windage_factor=windage_factor,
        )
        return with_envelope(grid_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/wind")
def get_wind_standard(
    lat: float = Query(19.12, description="Latitude"),
    lon: float = Query(71.85, description="Longitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
):
    try:
        from backend.integrations.wind.era5_wind_adapter import WindIntegrationAdapter
        bbox = (lon - 0.2, lat - 0.2, lon + 0.2, lat + 0.2)
        records = registry.weather.get_wind(bbox=bbox, timestamp=timestamp, resolution=0.15)
        adapter = WindIntegrationAdapter()
        if records:
            r = records[0]
            norm = adapter.normalize_wind_observation(
                lat=r["latitude"],
                lon=r["longitude"],
                u_ms=float(r["u_wind"]),
                v_ms=float(r["v_wind"]),
                timestamp=timestamp,
            )
        else:
            norm = adapter.normalize_wind_observation(lat, lon, 3.68, 3.68, timestamp, data_mode="CACHED")
        return with_envelope(norm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/ocean/current")
@router.get("/environment/ocean/current")
def get_ocean_current_standard(
    lat: float = Query(19.12, description="Latitude"),
    lon: float = Query(71.85, description="Longitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
):
    try:
        from backend.integrations.ocean.copernicus_ocean_adapter import OceanCurrentIntegrationAdapter
        bbox = (lon - 0.2, lat - 0.2, lon + 0.2, lat + 0.2)
        records = registry.ocean.get_currents(bbox=bbox, timestamp=timestamp, depth=0.0, resolution=0.15)
        adapter = OceanCurrentIntegrationAdapter()
        if records:
            r = records[0]
            norm = adapter.normalize_current_observation(
                lat=r["latitude"],
                lon=r["longitude"],
                u_ms=float(r["u_current"]),
                v_ms=float(r["v_current"]),
                timestamp=timestamp,
            )
        else:
            norm = adapter.normalize_current_observation(lat, lon, 0.30, -0.30, timestamp, data_mode="CACHED")
        return with_envelope(norm)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/weather")
@router.get("/environment/weather")
def get_weather_standard(
    lat: float = Query(19.12, description="Latitude"),
    lon: float = Query(71.85, description="Longitude"),
    timestamp: Optional[str] = Query(None, description="ISO timestamp (UTC)"),
):
    try:
        from backend.integrations.weather.weather_adapter import WeatherIntegrationAdapter
        adapter = WeatherIntegrationAdapter()
        res = adapter.get_weather_at_location(lat=lat, lon=lon, timestamp=timestamp)
        return with_envelope(res)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/environment/regional")
def get_regional_environment(
    min_lon: float = Query(65.0, description="West longitude"),
    min_lat: float = Query(5.0, description="South latitude"),
    max_lon: float = Query(80.0, description="East longitude"),
    max_lat: float = Query(25.0, description="North latitude"),
    step: float = Query(1.0, description="Grid step in degrees (zoom-adaptive)"),
    layer: str = Query("both", description="Layer: wind, current, or both"),
):
    """Wide-area regional wind & ocean current vector fields for map overlay.
    
    Zoom-adaptive step density:
    - zoom <= 5: step=2.0 (coarse overview)
    - zoom 6-8: step=1.0 (regional)
    - zoom 9-11: step=0.5 (detailed)
    - zoom >= 12: step=0.25 (high-density)
    """
    try:
        from backend.adapters.wind_adapter import WindDataAdapter
        from backend.adapters.ocean_adapter import OceanCurrentAdapter

        bbox = (min_lon, min_lat, max_lon, max_lat)
        result = {
            "bbox": list(bbox),
            "step": step,
            "layer": layer,
        }

        if layer in ("wind", "both"):
            wind_adapter = WindDataAdapter()
            wind_res = wind_adapter.get_regional_wind_field(bbox=bbox, step=step)
            result["wind"] = wind_res["data"]
            result["wind_metadata"] = wind_res["metadata"]
            result["wind_count"] = len(wind_res["data"])

        if layer in ("current", "both"):
            ocean_adapter = OceanCurrentAdapter()
            ocean_res = ocean_adapter.get_regional_current_field(bbox=bbox, step=step)
            result["currents"] = ocean_res["data"]
            result["currents_metadata"] = ocean_res["metadata"]
            result["currents_count"] = len(ocean_res["data"])

        return with_envelope(result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

