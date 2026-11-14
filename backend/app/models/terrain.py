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
class TerrainCutout:
    """Recorte cuadrado de elevación y mapa de pendientes centrado en un sitio."""

    lat: float
    lon: float
    width: int
    height: int
    step_m: float
    extent_km: float
    center_elevation_m: float
    min_elevation_m: float
    max_elevation_m: float
    elevations_m: np.ndarray  # (height, width), float32
    slopes_deg: np.ndarray  # (height, width), float32
    mean_slope_deg: float
    max_slope_deg: float
    safe_landing_fraction: float  # fracción de área con pendiente <= 15°
    source: str


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

    def cutout(self, lat: float, lon: float, size_px: int = 128, step: int = 1) -> TerrainCutout:
        """Extrae un parche regular de elevación centrado en (lat, lon) con cálculo de pendientes.

        - `size_px`: cantidad de puntos en ancho y alto (grilla cuadrada, p. ej. 128 o 256).
        - `step`: paso de muestreo en píxeles del DEM (1 = 120 m/px, 2 = 240 m/px...).
        """
        if size_px <= 0 or step <= 0:
            raise ValueError("size_px y step deben ser positivos")

        step_m = DEM_SCALE_M * step
        radius_km = (size_px * step_m) / 2000.0
        if not self.covers(lat, radius_km):
            raise ValueError(
                f"el DEM polar no cubre el radio de {radius_km:.1f} km alrededor de la latitud {lat}"
            )

        line_c, sample_c = self.pixel(np.array([lat]), np.array([lon]))
        half = (size_px // 2) * step
        l_start = int(round(line_c[0] - half))
        l_end = l_start + size_px * step
        s_start = int(round(sample_c[0] - half))
        s_end = s_start + size_px * step

        if l_start < 0 or s_start < 0 or l_end > DEM_SIZE or s_end > DEM_SIZE:
            raise ValueError(f"el recorte de {size_px}px excede los límites del DEM polar")

        raw = self.data[l_start:l_end:step, s_start:s_end:step]
        elevations = (raw.astype(np.float32) * DEM_HEIGHT_SCALE)

        # Cálculo vectorizado del gradiente de elevación y pendiente en grados
        dy, dx = np.gradient(elevations, step_m, step_m)
        slopes = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2))).astype(np.float32)

        center_h = float(self.height(np.array([lat]), np.array([lon]))[0])
        min_h = float(np.min(elevations))
        max_h = float(np.max(elevations))
        mean_slope = float(np.mean(slopes))
        max_slope = float(np.max(slopes))
        safe_fraction = float(np.mean(slopes <= 15.0))

        return TerrainCutout(
            lat=lat,
            lon=lon,
            width=size_px,
            height=size_px,
            step_m=step_m,
            extent_km=(size_px * step_m) / 1000.0,
            center_elevation_m=round(center_h, 1),
            min_elevation_m=round(min_h, 1),
            max_elevation_m=round(max_h, 1),
            elevations_m=elevations,
            slopes_deg=slopes,
            mean_slope_deg=round(mean_slope, 1),
            max_slope_deg=round(max_slope, 1),
            safe_landing_fraction=round(safe_fraction, 3),
            source=DEM_SOURCE,
        )


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
        aspect_deg: Steepest-descent slope azimuth in degrees [0.0, 360.0) clockwise from North.
        sky_view_factor: Hemispherical sky visibility factor in [0.0, 1.0].
    """

    elevation_m: float
    slope_deg: float
    roughness_m: float
    source: str
    aspect_deg: float = 0.0
    sky_view_factor: float = 1.0


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
    aspect_deg = math.degrees(math.atan2(-dz_dx, dz_dy)) % 360.0

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
        aspect_deg=round(aspect_deg, 1),
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
    aspect_deg = math.degrees(math.atan2(math.sin(lon_rad), math.cos(lat_rad))) % 360.0
    return TerrainMetrics(
        elevation_m=round(elevation_m, 1),
        slope_deg=round(max(0.0, slope_deg), 2),
        roughness_m=round(max(0.0, roughness_m), 2),
        source="fallback",
        aspect_deg=round(aspect_deg, 1),
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
            aspect_deg=float(terrain.get("aspect_deg", 0.0)) % 360.0,
            sky_view_factor=float(terrain.get("sky_view_factor", 1.0)),
        )
    return _evaluate_from_coordinates(round(float(lat), 6), round(float(lon), 6))


def compute_patch_shadow_step(
    elev: np.ndarray,
    u_row: float,
    u_col: float,
    tan_sun: float,
    step_m: float = DEM_SCALE_M,
    observer_height_m: float = OBSERVER_HEIGHT_M,
) -> np.ndarray:
    """Calcula la máscara binaria de sombra (True = en sombra) para un paso direccional sobre el parche."""
    size = elev.shape[0]
    rows, cols = np.indices((size, size))
    shadow = np.zeros((size, size), dtype=bool)
    z_target = elev + observer_height_m

    for k in range(1, size):
        r_k = np.clip(np.round(rows + k * u_row).astype(int), 0, size - 1)
        c_k = np.clip(np.round(cols + k * u_col).astype(int), 0, size - 1)
        moved = (r_k != rows) | (c_k != cols)
        dist = k * step_m
        tan_obs = (elev[r_k, c_k] - z_target) / dist
        shadow |= (moved & (tan_obs > tan_sun))
    return shadow


def compute_patch_solar_grid(
    elev: np.ndarray,
    lat: float,
    lon: float,
    sun_track,
    horizon_mask=None,
    step_m: float = DEM_SCALE_M,
    observer_height_m: float = OBSERVER_HEIGHT_M,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Calcula la iluminación instantánea en t0 y acumulada en la ventana para cada celda del parche.

    Returns:
        (instant_illum, window_illum_pct, mean_solar_pct)
    """
    size = elev.shape[0]
    n_samples = len(sun_track.hours)

    l0, s0 = PolarDEM.pixel(np.array([lat]), np.array([lon]))
    l_n, s_n = PolarDEM.pixel(np.array([lat + 1e-4]), np.array([lon]))
    l_e, s_e = PolarDEM.pixel(np.array([lat]), np.array([lon + 1e-4]))
    v_n = np.array([float(l_n[0] - l0[0]), float(s_n[0] - s0[0])])
    norm_n = np.linalg.norm(v_n)
    v_n = v_n / norm_n if norm_n > 0 else np.array([-1.0, 0.0])
    v_e = np.array([float(l_e[0] - l0[0]), float(s_e[0] - s0[0])])
    norm_e = np.linalg.norm(v_e)
    v_e = v_e / norm_e if norm_e > 0 else np.array([0.0, 1.0])

    illum_sum = np.zeros((size, size), dtype=float)
    instant_illum = np.zeros((size, size), dtype=bool)

    for i in range(n_samples):
        az = float(sun_track.azimuth[i])
        el = float(sun_track.elevation[i])

        if horizon_mask is not None:
            horiz_el = float(horizon_mask.elevation(np.array([az]))[0])
            if el <= horiz_el:
                continue
        elif el <= 0.0:
            continue

        u_sun = np.cos(np.radians(az)) * v_n + np.sin(np.radians(az)) * v_e
        u_r, u_c = float(u_sun[0]), float(u_sun[1])
        tan_sun = np.tan(np.radians(el))

        shadow = compute_patch_shadow_step(elev, u_r, u_c, tan_sun, step_m, observer_height_m)
        is_lit = ~shadow
        illum_sum += is_lit
        if i == 0:
            instant_illum = is_lit

    window_illum_pct = (illum_sum / max(1, n_samples)) * 100.0
    mean_solar_pct = float(np.mean(window_illum_pct))
    return instant_illum, window_illum_pct, mean_solar_pct


def evaluate_terrain_patch(
    lat: float,
    lon: float,
    size: int = 25,
    site_data: dict | None = None,
    ephemeris=None,
    date=None,
    window_days: float = 14.0,
    horizon_mask=None,
) -> dict:
    """Generates a local `size x size` elevation, slope, and solar grid around `(lat, lon)`."""
    if size < 5 or size % 2 == 0:
        raise ValueError("patch size must be an odd integer >= 5")

    dem = _get_polar_dem()
    half = size // 2
    source = "synthetic"
    elev = None
    slopes = None

    if dem is not None and lat <= DEM_MAX_LAT:
        line, sample = PolarDEM.pixel(np.asarray(lat, dtype=float), np.asarray(lon, dtype=float))
        l_idx = int(round(float(line)))
        s_idx = int(round(float(sample)))
        margin = half + 1
        if margin <= l_idx <= DEM_SIZE - 1 - margin and margin <= s_idx <= DEM_SIZE - 1 - margin:
            padded = (
                dem.data[l_idx - margin : l_idx + margin + 1, s_idx - margin : s_idx + margin + 1].astype(float)
                * DEM_HEIGHT_SCALE
            )
            dz_dx = (padded[1:-1, 2:] - padded[1:-1, :-2]) / (2.0 * DEM_SCALE_M)
            dz_dy = (padded[2:, 1:-1] - padded[:-2, 1:-1]) / (2.0 * DEM_SCALE_M)
            slopes = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
            elev = padded[1:-1, 1:-1]
            source = "lola_dem"

    if elev is None:
        metrics = evaluate_terrain(lat, lon, site_data=site_data)
        coords = (np.arange(size, dtype=float) - half) * DEM_SCALE_M
        gx, gy = np.meshgrid(coords, coords)
        slope_rad = math.radians(metrics.slope_deg)
        aspect_rad = math.radians(metrics.aspect_deg)
        grad = math.tan(slope_rad)
        base_plane = metrics.elevation_m + grad * (gx * math.sin(aspect_rad) + gy * math.cos(aspect_rad))
        phase = math.radians(lat * 7.0 + lon * 13.0)
        undulation = metrics.roughness_m * (
            1.2 * np.sin(gx / 280.0 + phase) * np.cos(gy / 280.0 - phase)
            + 0.6 * np.cos((gx + gy) / 190.0 + phase)
        )
        elev = base_plane + undulation
        dz_dy_g, dz_dx_g = np.gradient(elev, DEM_SCALE_M)
        slopes = np.degrees(np.arctan(np.hypot(dz_dx_g, dz_dy_g)))

    result = {
        "size": size,
        "spacing_m": DEM_SCALE_M,
        "elevation_m": np.round(elev, 1).tolist(),
        "slope_deg": np.round(slopes, 2).tolist(),
        "source": source,
    }

    if ephemeris is not None and date is not None:
        from app.models.site import Site

        dummy_site = Site(id="patch", name="patch", lat=lat, lon=lon)
        track = ephemeris.track(dummy_site, "sun", date, duration_h=window_days * 24.0, step_h=6.0)
        instant_illum, window_illum_pct, mean_solar_pct = compute_patch_solar_grid(
            elev, lat, lon, track, horizon_mask=horizon_mask
        )
        safe_slope = slopes <= 10.0
        good_sun = window_illum_pct >= 50.0
        optimal_pct = float(np.mean(safe_slope & good_sun)) * 100.0

        result["solar"] = {
            "window_days": window_days,
            "exposure_pct": np.round(window_illum_pct, 1).tolist(),
            "instant_lit": instant_illum.tolist(),
            "mean_solar_pct": round(mean_solar_pct, 1),
            "optimal_landing_pct": round(optimal_pct, 1),
            "sun_azimuth_deg": round(float(track.azimuth[0]), 2),
            "sun_elevation_deg": round(float(track.elevation[0]), 2),
        }

    return result
