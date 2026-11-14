"""Horizonte por terreno a partir del modelo de elevación polar de LOLA.

Producto: LDEM_75S_120M (PDS Geosciences), estereográfica polar sur, 120 m por
píxel, de 75° S al polo. Alturas en metros sobre la esfera de 1737,4 km.

Para cada azimut se recorre el terreno en línea recta (geodésica) desde el
sitio hasta MAX_DISTANCE_KM y se guarda el mayor ángulo de elevación que
alcanza el relieve, considerando la curvatura de la Luna. Ese ángulo es el
horizonte real: un cuerpo bajo él queda tapado por el terreno.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

DEM_FILE = "ldem_75s_120m.img"
DEM_SIZE = 7624
DEM_SCALE_M = 120.0
DEM_OFFSET_PX = 3811.5
DEM_HEIGHT_SCALE = 0.5
DEM_MAX_LAT = -75.0
DEM_SOURCE = "LOLA LDEM_75S_120M (PDS Geosciences)"
MOON_RADIUS_M = 1737400.0

AZIMUTH_STEP_DEG = 0.5
MAX_DISTANCE_KM = 150.0
OBSERVER_HEIGHT_M = 2.0  # paneles o antena de un módulo típico


@dataclass(frozen=True)
class HorizonMask:
    """Elevación del horizonte (grados) cada `azimuth_step_deg`, empezando en el norte."""

    lat: float
    lon: float
    azimuth_step_deg: float
    elevation_deg: np.ndarray
    distance_km: np.ndarray  # distancia al relieve que define el horizonte
    max_distance_km: float
    observer_height_m: float
    source: str

    @property
    def azimuths(self) -> np.ndarray:
        return np.arange(len(self.elevation_deg)) * self.azimuth_step_deg

    def to_json(self, site_id: str) -> dict:
        return {
            "site_id": site_id,
            "lat": self.lat,
            "lon": self.lon,
            "source": self.source,
            "observer_height_m": self.observer_height_m,
            "max_distance_km": self.max_distance_km,
            "azimuth_step_deg": self.azimuth_step_deg,
            "elevation_deg": [round(v, 3) for v in self.elevation_deg.tolist()],
            "distance_km": [round(v, 2) for v in self.distance_km.tolist()],
        }

    @classmethod
    def from_json(cls, data: dict) -> HorizonMask:
        return cls(
            lat=data["lat"],
            lon=data["lon"],
            azimuth_step_deg=data["azimuth_step_deg"],
            elevation_deg=np.asarray(data["elevation_deg"], dtype=float),
            distance_km=np.asarray(data["distance_km"], dtype=float),
            max_distance_km=data["max_distance_km"],
            observer_height_m=data["observer_height_m"],
            source=data["source"],
        )

    @classmethod
    def load(cls, path: Path) -> HorizonMask:
        return cls.from_json(json.loads(Path(path).read_text(encoding="utf-8")))


class PolarDEM:
    def __init__(self, path: Path):
        self.data = np.memmap(path, dtype="<i2", mode="r", shape=(DEM_SIZE, DEM_SIZE))

    @classmethod
    def open(cls, dem_dir: Path) -> PolarDEM | None:
        path = Path(dem_dir) / DEM_FILE
        return cls(path) if path.exists() else None

    @staticmethod
    def covers(lat: float, max_distance_km: float = MAX_DISTANCE_KM) -> bool:
        """True si el DEM alcanza a `max_distance_km` del sitio en todas las direcciones."""
        margin_deg = np.degrees(max_distance_km * 1000 / MOON_RADIUS_M)
        return lat <= DEM_MAX_LAT - margin_deg

    @staticmethod
    def pixel(lat: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """(línea, columna) con índice desde 0 en la estereográfica polar sur."""
        la, lo = np.radians(lat), np.radians(lon)
        r = 2 * MOON_RADIUS_M * np.tan(np.pi / 4 + la / 2)
        sample = DEM_OFFSET_PX + r * np.sin(lo) / DEM_SCALE_M
        line = DEM_OFFSET_PX - r * np.cos(lo) / DEM_SCALE_M
        return line, sample

    def height(self, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        """Altura (m) sobre la esfera de referencia, con interpolación bilineal."""
        line, sample = self.pixel(np.asarray(lat, float), np.asarray(lon, float))
        line = np.clip(line, 0, DEM_SIZE - 1.001)
        sample = np.clip(sample, 0, DEM_SIZE - 1.001)
        l0, s0 = np.floor(line).astype(int), np.floor(sample).astype(int)
        fl, fs = line - l0, sample - s0
        d = self.data
        top = d[l0, s0] * (1 - fs) + d[l0, s0 + 1] * fs
        bottom = d[l0 + 1, s0] * (1 - fs) + d[l0 + 1, s0 + 1] * fs
        return (top * (1 - fl) + bottom * fl) * DEM_HEIGHT_SCALE


def destination(lat: float, lon: float, azimuth_deg: np.ndarray, distance_m: np.ndarray):
    """Punto a `distance_m` del sitio en dirección `azimuth_deg`, sobre la esfera."""
    la, lo = np.radians(lat), np.radians(lon)
    az = np.radians(azimuth_deg)
    delta = distance_m / MOON_RADIUS_M
    lat2 = np.arcsin(np.sin(la) * np.cos(delta) + np.cos(la) * np.sin(delta) * np.cos(az))
    lon2 = lo + np.arctan2(np.sin(az) * np.sin(delta) * np.cos(la),
                           np.cos(delta) - np.sin(la) * np.sin(lat2))
    return np.degrees(lat2), np.degrees(lon2)


def compute_mask(dem: PolarDEM, lat: float, lon: float,
                 azimuth_step_deg: float = AZIMUTH_STEP_DEG,
                 max_distance_km: float = MAX_DISTANCE_KM,
                 observer_height_m: float = OBSERVER_HEIGHT_M) -> HorizonMask:
    if not PolarDEM.covers(lat, max_distance_km):
        raise ValueError(f"el DEM no cubre {max_distance_km} km alrededor de la latitud {lat}")

    azimuths = np.arange(0.0, 360.0, azimuth_step_deg)
    distances = np.arange(DEM_SCALE_M, max_distance_km * 1000 + 1, DEM_SCALE_M)
    lat2, lon2 = destination(lat, lon, azimuths[:, None], distances[None, :])
    heights = dem.height(lat2, lon2)

    # Ángulo de elevación exacto sobre la esfera: observador y relieve a sus radios reales.
    r0 = MOON_RADIUS_M + float(dem.height(lat, lon)) + observer_height_m
    r1 = MOON_RADIUS_M + heights
    theta = distances / MOON_RADIUS_M
    angles = np.degrees(np.arctan2(r1 * np.cos(theta) - r0, r1 * np.sin(theta)))

    best = np.argmax(angles, axis=1)
    rows = np.arange(len(azimuths))
    return HorizonMask(
        lat=lat,
        lon=lon,
        azimuth_step_deg=azimuth_step_deg,
        elevation_deg=angles[rows, best],
        distance_km=distances[best] / 1000,
        max_distance_km=max_distance_km,
        observer_height_m=observer_height_m,
        source=DEM_SOURCE,
    )


_DEM_DIR = Path(__file__).resolve().parents[2] / "data" / "dem"


@dataclass(frozen=True)
class TerrainMetrics:
    """Immutable topographical safety and elevation metrics for a lunar surface site.

    Attributes:
        elevation_m: Altitude in meters relative to the 1,737.4 km mean lunar sphere.
        slope_deg: Local surface slope in degrees (>= 0.0).
        roughness_m: Local RMS surface roughness in meters (>= 0.0).
        source: Data origin identifier ("catalog", "lola_dem", or "fallback").
    """

    elevation_m: float
    slope_deg: float
    roughness_m: float
    source: str


@lru_cache(maxsize=1)
def _get_polar_dem() -> PolarDEM | None:
    """Loads and caches the South Pole LOLA DEM if present on disk.

    Returns:
        Opened PolarDEM instance, or None when the DEM file is absent.
    """
    return PolarDEM.open(_DEM_DIR)


def _evaluate_lola_dem(dem: PolarDEM, lat: float, lon: float) -> TerrainMetrics | None:
    """Computes slope and RMS roughness from a 3x3 LOLA DEM pixel window.

    Fits a local plane z(x, y) = a*x + b*y + c over the 3x3 neighborhood around
    (lat, lon) scaled by DEM_SCALE_M (120 m/pixel), then derives:
        slope_deg = degrees(arctan(sqrt((dz/dx)^2 + (dz/dy)^2)))
        roughness_m = RMS(z - (a*x + b*y + c))

    Args:
        dem: Opened South Pole LOLA DEM instance.
        lat: Planetocentric latitude in degrees.
        lon: East longitude in degrees.

    Returns:
        TerrainMetrics with source="lola_dem", or None if outside DEM bounds.
    """
    if lat > DEM_MAX_LAT:
        return None
    line, sample = PolarDEM.pixel(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float))
    l_idx = int(round(float(line)))
    s_idx = int(round(float(sample)))
    if not (1 <= l_idx <= DEM_SIZE - 2 and 1 <= s_idx <= DEM_SIZE - 2):
        return None

    patch = dem.data[l_idx - 1 : l_idx + 2, s_idx - 1 : s_idx + 2].astype(float) * DEM_HEIGHT_SCALE
    dz_dx = float(np.sum(patch[:, 2] - patch[:, 0])) / (6.0 * DEM_SCALE_M)
    dz_dy = float(np.sum(patch[2, :] - patch[0, :])) / (6.0 * DEM_SCALE_M)
    slope_deg = math.degrees(math.atan(math.hypot(dz_dx, dz_dy)))

    coords = np.array([-DEM_SCALE_M, 0.0, DEM_SCALE_M], dtype=float)
    dx_grid, dy_grid = np.meshgrid(coords, coords)
    plane_z = float(np.mean(patch)) + dz_dx * dx_grid + dz_dy * dy_grid
    roughness_m = float(np.sqrt(np.mean((patch - plane_z) ** 2)))

    elevation_m = float(dem.height(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float)))
    return TerrainMetrics(
        elevation_m=round(elevation_m, 1),
        slope_deg=round(max(0.0, slope_deg), 2),
        roughness_m=round(max(0.0, roughness_m), 2),
        source="lola_dem",
    )


def _evaluate_fallback(lat: float, lon: float) -> TerrainMetrics:
    """Provides a deterministic, smooth coordinate-based terrain estimate.

    Used when coordinates lie outside polar DEM coverage or when the DEM file
    is not installed locally.

    Args:
        lat: Planetocentric latitude in degrees.
        lon: East longitude in degrees.

    Returns:
        TerrainMetrics with source="fallback".
    """
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    polar_factor = abs(math.sin(lat_rad)) ** 2
    elevation_m = -1800.0 + 3400.0 * polar_factor + 700.0 * math.cos(2.0 * lon_rad) * math.cos(lat_rad)
    slope_deg = 2.0 + 5.5 * polar_factor + 2.5 * abs(math.sin(3.0 * lat_rad + lon_rad))
    roughness_m = 0.5 + 0.9 * polar_factor + 0.4 * abs(math.cos(2.0 * lat_rad - lon_rad))
    return TerrainMetrics(
        elevation_m=round(elevation_m, 1),
        slope_deg=round(max(0.0, slope_deg), 2),
        roughness_m=round(max(0.0, roughness_m), 2),
        source="fallback",
    )


@lru_cache(maxsize=1024)
def _evaluate_from_coordinates(lat_deg: float, lon_deg: float) -> TerrainMetrics:
    """Cached topographical lookup for coordinates without catalog metadata.

    Args:
        lat_deg: Rounded planetocentric latitude in degrees.
        lon_deg: Rounded east longitude in degrees.

    Returns:
        TerrainMetrics from the LOLA DEM when covered, otherwise fallback.
    """
    dem = _get_polar_dem()
    if dem is not None:
        lola_metrics = _evaluate_lola_dem(dem, lat_deg, lon_deg)
        if lola_metrics is not None:
            return lola_metrics
    return _evaluate_fallback(lat_deg, lon_deg)


def evaluate_terrain(lat: float, lon: float, site_data: dict | None = None) -> TerrainMetrics:
    """Evaluates lunar surface elevation, slope, and roughness for a site.

    Resolution priority:
        1. Curated catalog metadata ("catalog") when `site_data["terrain"]` exists.
        2. South Pole LOLA DEM ("lola_dem") 3x3 plane fit when available and covered.
        3. Deterministic smooth coordinate estimator ("fallback").

    Args:
        lat: Planetocentric latitude in degrees [-90, 90].
        lon: East longitude in degrees [-180, 180].
        site_data: Optional raw catalog dictionary for the site.

    Returns:
        Immutable TerrainMetrics instance with elevation, slope, roughness, and source.
    """
    if site_data and isinstance(site_data.get("terrain"), dict):
        terrain = site_data["terrain"]
        return TerrainMetrics(
            elevation_m=float(terrain["elevation_m"]),
            slope_deg=max(0.0, float(terrain["slope_deg"])),
            roughness_m=max(0.0, float(terrain["roughness_m"])),
            source="catalog",
        )
    return _evaluate_from_coordinates(round(float(lat), 6), round(float(lon), 6))
