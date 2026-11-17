"""Capas del polo sur en grilla estereográfica polar: relieve, luz, Tierra y zonas óptimas.

La grilla global de 72×36 se deforma en el polo (bloques en abanico de 5°), justo donde
importa. Este módulo trabaja en la misma proyección del DEM LOLA `LDEM_75S_120M`: una
grilla cuadrada de `GRID_N`×`GRID_N` celdas de `CELL_M` metros centrada en el polo.

Qué es medido y qué es estimado:

- Medido (LOLA, 120 m): altura del centro de cada celda, pendiente media de la celda y
  fracción de la celda con pendiente bajo el límite del HLS (8°).
- Estimado (geometría de Zenith): luz y visibilidad de la Tierra. Para el centro de cada
  celda se guarda el horizonte del relieve en `HORIZON_DIRECTIONS` direcciones (con la
  curvatura lunar, observador a 2 m) y se compara con la posición real del Sol y de la
  Tierra según las efemérides del JPL: declinación solar y libración de cada fecha.
  No reemplaza los mapas oficiales de NASA PGDA; la comparación está en
  docs/modelo/08-capas-polares.md.

El archivo `data/polar/south_pole.npz` se versiona: la aplicación no necesita el DEM de
116 MB. Se regenera con `./run.sh polar` (requiere `./run.sh data --dem`).
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.models.ephemeris import MOON_RADIUS_KM, Ephemeris
from app.models.terrain import (
    DEM_HEIGHT_SCALE,
    DEM_OFFSET_PX,
    DEM_SCALE_M,
    DEM_SIZE,
    DEM_SOURCE,
    MAX_DISTANCE_KM,
    MOON_RADIUS_M,
    OBSERVER_HEIGHT_M,
    PolarDEM,
)

DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "polar" / "south_pole.npz"

GRID_N = 151  # impar: la celda central queda exactamente en el polo
BLOCK_PX = 20  # píxeles del DEM por celda
CELL_M = BLOCK_PX * DEM_SCALE_M  # 2,4 km
HORIZON_DIRECTIONS = 48  # una cada 7,5°
# El horizonte se guarda en un byte: de -10° a +41° en pasos de 0,2°.
HORIZON_OFFSET_DEG = -10.0
HORIZON_STEP_DEG = 0.2

# Paso del recorrido del relieve: el del DEM cerca del observador y más largo a partir de ahí.
NEAR_DISTANCE_M = 12000.0
FAR_STEP_M = 360.0

CHUNK_SAMPLES = 48
WORKERS = min(8, os.cpu_count() or 1)

SUN_DISC_RADIUS_DEG = 0.267
# Inclinación máxima del ecuador lunar respecto de la eclíptica: el Sol nunca sube más que esto
# sobre el horizonte geométrico del polo.
MAX_SOLAR_DECLINATION_DEG = 1.54

# Zona óptima: la celda debe tener sitio plano donde posarse, luz y enlace buena parte del tiempo.
FLAT_SLOPE_DEG = 8.0
OPTIMAL_MIN_FLAT_PCT = 30.0
OPTIMAL_MIN_SUN_PCT = 50.0
OPTIMAL_MIN_EARTH_PCT = 50.0


@dataclass(frozen=True, eq=False)
class PolarGrid:
    """Producto precalculado del polo sur. Los arreglos por celda van en orden fila-columna del DEM:
    la fila 0 es el borde hacia la longitud 0° (la Tierra) y la columna crece hacia el este."""

    height_m: np.ndarray  # (N, N) altura del centro de la celda
    slope_deg: np.ndarray  # (N, N) pendiente media a 120 m dentro de la celda
    flat_pct: np.ndarray  # (N, N) % de la celda con pendiente <= FLAT_SLOPE_DEG
    horizon_deg: np.ndarray  # (N, N, K) horizonte del relieve por dirección de la grilla
    psr: np.ndarray  # (N, N) bool: el centro de la celda nunca ve el Sol
    psr_distance_km: np.ndarray  # (N, N) distancia a la celda en sombra permanente más cercana
    stride: int = 1  # 1 = grilla completa; 2 = una de cada dos celdas (cálculos largos)

    @property
    def n(self) -> int:
        return self.height_m.shape[0]

    @property
    def cell_m(self) -> float:
        return CELL_M * self.stride

    @property
    def half_extent_km(self) -> float:
        return GRID_N * CELL_M / 2000.0

    @property
    def lat(self) -> np.ndarray:
        return cell_coordinates()[0][::self.stride, ::self.stride]

    @property
    def lon(self) -> np.ndarray:
        return cell_coordinates()[1][::self.stride, ::self.stride]

    def coarse(self, stride: int) -> PolarGrid:
        """La misma grilla tomando una de cada `stride` celdas: para recorridos largos (un año)."""
        if self.stride != 1:
            raise ValueError("solo se reduce la grilla completa")
        cut = (slice(None, None, stride), slice(None, None, stride))
        return PolarGrid(self.height_m[cut], self.slope_deg[cut], self.flat_pct[cut], self.horizon_deg[cut],
                         self.psr[cut], self.psr_distance_km[cut], stride)

    def cell_of(self, lat: float, lon: float) -> tuple[int, int] | None:
        """(fila, columna) de la celda que contiene el punto; None si queda fuera de la grilla."""
        line, sample = PolarDEM.pixel(np.asarray(lat, float), np.asarray(lon, float))
        first = _first_pixel(GRID_N)
        block = BLOCK_PX * self.stride
        row = int(np.floor((float(line) + 0.5 - first) / block))
        col = int(np.floor((float(sample) + 0.5 - first) / block))
        return (row, col) if 0 <= row < self.n and 0 <= col < self.n else None


def _first_pixel(n: int) -> int:
    """Primer píxel del DEM que cubre la grilla, con el polo en el centro de la celda central."""
    return int(round(DEM_OFFSET_PX + 0.5 - n * BLOCK_PX / 2))


@lru_cache(maxsize=4)
def cell_coordinates(n: int = GRID_N) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """(lat, lon, línea, muestra) del centro de cada celda, como arreglos (n, n)."""
    centers = _first_pixel(n) + (np.arange(n) + 0.5) * BLOCK_PX - 0.5
    line, sample = np.meshgrid(centers, centers, indexing="ij")
    x = (sample - DEM_OFFSET_PX) * DEM_SCALE_M  # hacia la longitud 90° E
    y = (DEM_OFFSET_PX - line) * DEM_SCALE_M  # hacia la longitud 0°
    colatitude = 2 * np.degrees(np.arctan(np.hypot(x, y) / (2 * MOON_RADIUS_M)))
    return colatitude - 90.0, np.degrees(np.arctan2(x, y)), line, sample


# ---- Construcción desde el DEM (solo para scripts/compute_polar_layers.py y las pruebas) ----


def horizon_from_dem(dem: PolarDEM, line: np.ndarray, sample: np.ndarray,
                     directions: int = HORIZON_DIRECTIONS,
                     max_distance_km: float = MAX_DISTANCE_KM) -> np.ndarray:
    """Horizonte del relieve (grados) desde cada punto (línea, muestra), por dirección de la grilla.

    La dirección k apunta a k·360/`directions` grados en el plano de la proyección, medidos en
    sentido horario desde la longitud 0°. La estereográfica es conforme, así que el azimut real
    de esa dirección desde un punto de longitud `lon` es k·360/directions − lon.
    """
    data = np.asarray(dem.data)
    line = np.asarray(line, float).ravel()
    sample = np.asarray(sample, float).ravel()

    def height(li: np.ndarray, si: np.ndarray) -> np.ndarray:
        """Altura (m) con interpolación bilineal; fuera del DEM, muy por debajo de cualquier horizonte."""
        inside = (li >= 0) & (li <= DEM_SIZE - 1) & (si >= 0) & (si <= DEM_SIZE - 1)
        l0 = np.clip(np.floor(li).astype(int), 0, DEM_SIZE - 2)
        s0 = np.clip(np.floor(si).astype(int), 0, DEM_SIZE - 2)
        fl, fs = np.clip(li - l0, 0, 1), np.clip(si - s0, 0, 1)
        top = data[l0, s0] * (1 - fs) + data[l0, s0 + 1] * fs
        bottom = data[l0 + 1, s0] * (1 - fs) + data[l0 + 1, s0 + 1] * fs
        return np.where(inside, (top * (1 - fl) + bottom * fl) * DEM_HEIGHT_SCALE, -MOON_RADIUS_M / 2)

    r0 = MOON_RADIUS_M + height(line, sample) + OBSERVER_HEIGHT_M
    # Paso fino cerca del observador, donde una loma vecina cambia mucho el ángulo; más largo lejos.
    distances = np.concatenate([
        np.arange(DEM_SCALE_M, NEAR_DISTANCE_M + 1, DEM_SCALE_M),
        np.arange(NEAR_DISTANCE_M + FAR_STEP_M, max_distance_km * 1000 + 1, FAR_STEP_M),
    ])
    arc = distances / MOON_RADIUS_M
    out = np.empty((line.size, directions), dtype=np.float32)
    for k in range(directions):
        theta = 2 * np.pi * k / directions
        d_sample, d_line = np.sin(theta), -np.cos(theta)
        best = np.full(line.size, -np.inf)
        for distance, a in zip(distances, arc):
            px = distance / DEM_SCALE_M
            r1 = MOON_RADIUS_M + height(line + d_line * px, sample + d_sample * px)
            best = np.maximum(best, np.arctan2(r1 * np.cos(a) - r0, r1 * np.sin(a)))
        out[:, k] = np.degrees(best)
    return out


def _permanent_shadow(lat: np.ndarray, lon: np.ndarray, horizon_deg: np.ndarray) -> np.ndarray:
    """True donde ni el borde superior del Sol asoma en su mejor verano (declinación máxima)."""
    directions = horizon_deg.shape[-1]
    lit = np.zeros(lat.shape, dtype=bool)
    la = np.radians(lat)
    dec = -np.radians(MAX_SOLAR_DECLINATION_DEG)  # verano del polo sur
    for k in range(directions):
        # Sol en la dirección k de la grilla: su longitud subsolar es k·360/directions.
        hour_angle = np.radians(360.0 * k / directions - lon)
        elevation = np.degrees(np.arcsin(np.sin(la) * np.sin(dec) + np.cos(la) * np.cos(dec) * np.cos(hour_angle)))
        lit |= elevation + SUN_DISC_RADIUS_DEG > horizon_deg[..., k]
    return ~lit


def _distance_to(mask: np.ndarray) -> np.ndarray:
    """Distancia (km) de cada celda a la celda marcada más cercana; infinito si no hay ninguna."""
    n = mask.shape[0]
    rows, cols = np.nonzero(mask)
    if rows.size == 0:
        return np.full(mask.shape, np.inf, dtype=np.float32)
    ii, jj = np.mgrid[0:n, 0:n]
    best = np.full(mask.shape, np.inf)
    for start in range(0, rows.size, 512):  # por tandas, para no armar una matriz de celdas × celdas
        r, c = rows[start:start + 512], cols[start:start + 512]
        d2 = (ii[..., None] - r) ** 2 + (jj[..., None] - c) ** 2
        best = np.minimum(best, d2.min(axis=-1))
    return (np.sqrt(best) * CELL_M / 1000.0).astype(np.float32)


def build_grid(dem: PolarDEM, n: int = GRID_N) -> PolarGrid:
    """Calcula el producto completo desde el DEM polar (tarda cerca de un minuto)."""
    lat, lon, line, sample = cell_coordinates(n)
    first = _first_pixel(n)
    block = np.asarray(dem.data[first:first + n * BLOCK_PX, first:first + n * BLOCK_PX], dtype=np.float32) * DEM_HEIGHT_SCALE
    gy, gx = np.gradient(block, DEM_SCALE_M)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))

    def per_cell(values: np.ndarray) -> np.ndarray:
        return values.reshape(n, BLOCK_PX, n, BLOCK_PX).mean(axis=(1, 3))

    horizon = horizon_from_dem(dem, line, sample).reshape(n, n, HORIZON_DIRECTIONS)
    psr = _permanent_shadow(lat, lon, horizon)
    return PolarGrid(
        height_m=dem.height(lat, lon).astype(np.float32),
        slope_deg=per_cell(slope).astype(np.float32),
        flat_pct=(per_cell((slope <= FLAT_SLOPE_DEG).astype(np.float32)) * 100).astype(np.float32),
        horizon_deg=horizon,
        psr=psr,
        psr_distance_km=_distance_to(psr),
    )


def save_grid(grid: PolarGrid, path: Path = DATA_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    quantized = np.rint((grid.horizon_deg - HORIZON_OFFSET_DEG) / HORIZON_STEP_DEG)
    meta = {
        "source": DEM_SOURCE,
        "cell_m": CELL_M,
        "flat_slope_deg": FLAT_SLOPE_DEG,
        "horizon": {"directions": HORIZON_DIRECTIONS, "max_distance_km": MAX_DISTANCE_KM,
                    "observer_height_m": OBSERVER_HEIGHT_M, "offset_deg": HORIZON_OFFSET_DEG,
                    "step_deg": HORIZON_STEP_DEG},
    }
    np.savez_compressed(
        path,
        meta=np.array(json.dumps(meta)),
        height_m=np.rint(grid.height_m).astype(np.int16),
        slope_x10=np.rint(grid.slope_deg * 10).astype(np.uint16),
        flat_pct=np.rint(grid.flat_pct).astype(np.uint8),
        horizon=np.clip(quantized, 0, 255).astype(np.uint8),
        psr=grid.psr,
        psr_distance_x10=np.rint(np.minimum(grid.psr_distance_km, 6000.0) * 10).astype(np.uint16),
    )


@lru_cache(maxsize=1)
def load_grid(path: Path = DATA_FILE) -> PolarGrid | None:
    """El producto versionado, o None si el archivo no está (p. ej. un despliegue recortado)."""
    if not Path(path).is_file():
        return None
    with np.load(path) as data:
        meta = json.loads(str(data["meta"]))["horizon"]
        return PolarGrid(
            height_m=data["height_m"].astype(np.float32),
            slope_deg=data["slope_x10"].astype(np.float32) / 10.0,
            flat_pct=data["flat_pct"].astype(np.float32),
            horizon_deg=data["horizon"].astype(np.float32) * meta["step_deg"] + meta["offset_deg"],
            psr=data["psr"].astype(bool),
            psr_distance_km=data["psr_distance_x10"].astype(np.float32) / 10.0,
        )


# ---- Luz y Tierra para una fecha ----


@dataclass(frozen=True)
class Visibility:
    """Serie por celda de un cuerpo: `clear[c, t]` es True si se ve en el instante t."""

    hours: np.ndarray  # (T,)
    clear: np.ndarray  # (N·N, T) bool
    max_elevation_deg: np.ndarray  # (N·N,) mayor altura sobre el horizonte geométrico mientras se ve


@lru_cache(maxsize=2)
def _cell_frames(grid: PolarGrid) -> tuple[np.ndarray, ...]:
    """Ejes locales (este, norte, arriba) de cada celda en el marco ME, radio y longitud."""
    lat, lon = np.radians(grid.lat.ravel()), np.radians(grid.lon.ravel())
    up = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    east = np.stack([-np.sin(lon), np.cos(lon), np.zeros_like(lon)])
    north = np.cross(up.T, east.T).T
    radius_km = MOON_RADIUS_KM + grid.height_m.ravel() / 1000.0
    return tuple(a.astype(np.float32) for a in (east, north, up, radius_km, np.degrees(lon)))


def visibility(grid: PolarGrid, ephemeris: Ephemeris, body: str, start: datetime,
               duration_h: float, step_h: float, margin_deg: float = 0.0) -> Visibility:
    """Para cada celda, en qué instantes `body` queda `margin_deg` por sobre el horizonte del relieve."""
    hours, direction, distance_km = ephemeris.direction_track(body, start, duration_h, step_h)
    east, north, up, radius_km, lon_deg = _cell_frames(grid)
    directions = grid.horizon_deg.shape[-1]
    horizon = grid.horizon_deg.reshape(-1).astype(np.float32)
    first_of_cell = (np.arange(up.shape[1]) * directions)[None, :]
    per_degree = np.float32(directions / 360.0)
    degrees = np.float32(180.0 / np.pi)

    def solve(first: int) -> tuple[int, np.ndarray, np.ndarray]:
        chunk = slice(first, first + CHUNK_SAMPLES)
        # Vector del centro de la celda al cuerpo: importa para la Tierra (paralaje de ~0,26°).
        target = (direction[chunk] * distance_km[chunk, None]).astype(np.float32)  # (t, 3)
        x, y = target @ east, target @ north  # (t, celdas)
        z = target @ up - radius_km
        elevation = np.arctan2(z, np.hypot(x, y)) * degrees
        # Dirección de la grilla = azimut + longitud (la proyección es conforme).
        position = np.mod(np.arctan2(x, y) * degrees + lon_deg, np.float32(360.0)) * per_degree
        low = position.astype(np.int32)
        frac = position - low
        low %= directions
        terrain = horizon[first_of_cell + low] * (1 - frac) + horizon[first_of_cell + (low + 1) % directions] * frac
        visible = elevation - terrain > margin_deg
        return first, visible.T, np.where(visible, elevation, np.float32(-90.0)).max(axis=0)

    clear = np.empty((up.shape[1], hours.size), dtype=bool)
    peak = np.full(up.shape[1], -90.0, dtype=np.float32)
    # Por tandas de instantes (acota la memoria) y en paralelo: NumPy suelta el GIL en estas operaciones.
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for first, visible, highest in pool.map(solve, range(0, hours.size, CHUNK_SAMPLES)):
            clear[:, first:first + visible.shape[1]] = visible
            peak = np.maximum(peak, highest)
    return Visibility(hours, clear, peak)


def continuous_from_start(clear: np.ndarray) -> np.ndarray:
    """Para cada instante, cuántas muestras seguidas quedan con el cuerpo a la vista desde ahí."""
    run = np.zeros(clear.shape, dtype=np.int16)
    ahead = np.zeros(clear.shape[0], dtype=np.int16)
    for t in range(clear.shape[1] - 1, -1, -1):
        ahead = (ahead + 1) * clear[:, t]
        run[:, t] = ahead
    return run


def optimal_mask(grid: PolarGrid, sun_pct: np.ndarray, earth_pct: np.ndarray) -> np.ndarray:
    """Celdas que cumplen los tres factores a la vez: terreno apto, luz y enlace con la Tierra."""
    return (
        (grid.flat_pct.ravel() >= OPTIMAL_MIN_FLAT_PCT)
        & (sun_pct >= OPTIMAL_MIN_SUN_PCT)
        & (earth_pct >= OPTIMAL_MIN_EARTH_PCT)
    )
