"""Standardized Data Adapters for INFINOVA."""
from backend.adapters.ais_adapter import AISDataAdapter
from backend.adapters.ocean_adapter import OceanCurrentAdapter
from backend.adapters.satellite_adapter import SentinelSatelliteAdapter
from backend.adapters.wind_adapter import WindDataAdapter

__all__ = [
    "SentinelSatelliteAdapter",
    "WindDataAdapter",
    "OceanCurrentAdapter",
    "AISDataAdapter",
]
