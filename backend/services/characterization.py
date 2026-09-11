from __future__ import annotations

import math

import cv2
import numpy as np

try:
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
except Exception:  # pragma: no cover
    Polygon = None
    unary_union = None


def _pixel_to_lonlat(x: float, y: float, georef: dict, shape: tuple[int, int]) -> tuple[float, float]:
    h, w = shape
    lon = georef["west"] + (x / max(w - 1, 1)) * (georef["east"] - georef["west"])
    lat = georef["north"] - (y / max(h - 1, 1)) * (georef["north"] - georef["south"])
    return lon, lat


def _meters_per_degree(lat: float) -> tuple[float, float]:
    m_lat = 111_320.0
    m_lon = 111_320.0 * math.cos(math.radians(lat))
    return m_lon, m_lat


def characterize_mask(mask, georef: dict | None = None, confidence: float = 0.0) -> dict:
    arr = np.array(mask, dtype=np.uint8)
    if arr.max() > 1:
        arr = (arr > 0).astype(np.uint8)
    if arr.sum() == 0:
        raise ValueError("Empty detection mask: cannot characterise spill geometry.")

    contours, _ = cv2.findContours(arr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise ValueError("No contours found in detection mask.")
    contour = max(contours, key=cv2.contourArea)
    area_px = float(cv2.contourArea(contour))
    peri_px = float(cv2.arcLength(contour, True))
    m = cv2.moments(contour)
    if m["m00"] == 0:
        raise ValueError("Invalid contour moments.")
    cx_px = m["m10"] / m["m00"]
    cy_px = m["m01"] / m["m00"]
    rect = cv2.minAreaRect(contour)
    (rw, rh) = rect[1]
    orientation_deg = float(rect[2])
    if rw < rh:
        orientation_deg = (orientation_deg + 90.0) % 180.0
    length_px = float(max(rw, rh))
    width_px = float(min(rw, rh) if min(rw, rh) > 0 else 1.0)
    aspect = length_px / width_px
    compactness = (4 * math.pi * area_px / (peri_px ** 2)) if peri_px else 0.0
    solidity = float(area_px / cv2.contourArea(cv2.convexHull(contour))) if cv2.contourArea(cv2.convexHull(contour)) else 0.0

    georef_provided = georef is not None
    georef = georef or {"north": 19.28, "south": 18.92, "west": 71.62, "east": 72.02}
    lon, lat = _pixel_to_lonlat(cx_px, cy_px, georef, arr.shape)
    m_lon, m_lat = _meters_per_degree(lat)
    px_w = abs(georef["east"] - georef["west"]) / max(arr.shape[1] - 1, 1)
    px_h = abs(georef["north"] - georef["south"]) / max(arr.shape[0] - 1, 1)
    m_per_px_x = px_w * m_lon
    m_per_px_y = px_h * m_lat
    m_per_px = (m_per_px_x + m_per_px_y) / 2.0

    area_km2 = area_px * m_per_px_x * m_per_px_y / 1e6
    peri_km = peri_px * m_per_px / 1000.0
    length_km = length_px * m_per_px / 1000.0
    width_km = width_px * m_per_px / 1000.0

    ring = []
    for pt in contour.squeeze():
        if np.ndim(pt) == 0:
            continue
        x, y = float(pt[0]), float(pt[1])
        ring.append(list(_pixel_to_lonlat(x, y, georef, arr.shape)))
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])

    shapely_ok = False
    if Polygon and len(ring) >= 4:
        try:
            poly = Polygon(ring)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.geom_type == "MultiPolygon":
                poly = max(poly.geoms, key=lambda g: g.area)
            ring = [list(c) for c in poly.exterior.coords]
            shapely_ok = True
        except Exception:
            shapely_ok = False

    shape_note = "elongated" if aspect >= 2.5 else "compact"
    if solidity < 0.7:
        shape_note += ", irregular"

    xs = [p[0] for p in ring] or [lon]
    ys = [p[1] for p in ring] or [lat]
    bbox = {
        "west": round(min(xs), 5),
        "east": round(max(xs), 5),
        "south": round(min(ys), 5),
        "north": round(max(ys), 5),
    }

    return {
        "ok": True,
        "area_km2": round(area_km2, 2),
        "length_km": round(length_km, 2),
        "width_km": round(width_km, 2),
        "perimeter_km": round(peri_km, 2),
        "aspect_ratio": round(aspect, 2),
        "orientation_deg": round(orientation_deg, 1),
        "compactness": round(compactness, 3),
        "solidity": round(solidity, 3),
        "shape_characteristics": shape_note,
        "centroid": {
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
        },
        "bounding_box": bbox,
        "bbox": [bbox["west"], bbox["south"], bbox["east"], bbox["north"]],
        "polygon": ring,
        "geojson_polygon": {
            "type": "Polygon",
            "coordinates": [ring],
        },
        "confidence": round(float(confidence or 0.0), 4),
        "geometry_source": "shapely_polygon" if shapely_ok else "opencv_contour",
        "measurement_quality": "prototype estimate",
        "units_note": (
            "Area/length/width are approximate geographic estimates from the demo scene "
            "georeference, not calibrated SAR ground-range products."
        ),
        "georef_source": "incident_georef" if georef_provided else "default_demo_bounds",
        "pixel_metrics": {
            "area_px": round(area_px, 1),
            "length_px": round(length_px, 1),
            "width_px": round(width_px, 1),
            "perimeter_px": round(peri_px, 1),
        },
        "status": "Completed",
    }
