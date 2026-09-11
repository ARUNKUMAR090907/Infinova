from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class SatelliteProvider(ABC):
    """Abstract interface for satellite scene discovery and acquisition."""

    @abstractmethod
    def search_scenes(
        self,
        bbox: Tuple[float, float, float, float],
        start_datetime: str,
        end_datetime: str,
        platform: str = "Sentinel-1",
        product_type: str = "GRD",
        polarisation: Optional[str] = None,
        max_scenes: int = 10,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_scene(self, scene_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_health(self) -> Dict[str, Any]:
        pass


class AISProvider(ABC):
    """Abstract interface for AIS vessel monitoring and trajectory correlation."""

    @abstractmethod
    def get_vessels(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        time_window: Optional[Tuple[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def filter_vessels(
        self,
        origin: Dict[str, float],
        origin_time: str,
        window_hours: float = 3.0,
        spatial_km: float = 35.0,
        corridor: Optional[List[List[float]]] = None,
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def get_vessel(self, mmsi: int) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_track(
        self,
        mmsi: int,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_health(self) -> Dict[str, Any]:
        pass


class WeatherProvider(ABC):
    """Abstract interface for marine atmospheric forcing (wind vectors)."""

    @abstractmethod
    def get_wind(
        self,
        bbox: Tuple[float, float, float, float],
        timestamp: Optional[str] = None,
        resolution: float = 0.25,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_health(self) -> Dict[str, Any]:
        pass


class OceanCurrentProvider(ABC):
    """Abstract interface for hydrodynamic ocean current vectors."""

    @abstractmethod
    def get_currents(
        self,
        bbox: Tuple[float, float, float, float],
        timestamp: Optional[str] = None,
        depth: float = 0.0,
        resolution: float = 0.25,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_health(self) -> Dict[str, Any]:
        pass
