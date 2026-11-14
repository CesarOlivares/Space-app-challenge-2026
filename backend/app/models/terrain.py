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
from dataclasses import dataclass
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
