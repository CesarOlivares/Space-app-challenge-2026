"""Elevación del horizonte local según el azimut.

Sin atmósfera, el horizonte lo fijan el terreno y la curvatura de la esfera:

- Horizonte por terreno: máscara calculada con el DEM polar de LOLA
  (ver terrain.py). Se usa la precalculada de data/horizons/<id>.json o, para
  coordenadas personalizadas, se calcula al vuelo si el DEM está descargado.
- Horizonte esférico: 0° en todas direcciones, para el resto de los sitios.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np

from app.models.site import Site
from app.models.terrain import HorizonMask, PolarDEM, compute_mask

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
MASKS_DIR = DATA_DIR / "horizons"
DEM_DIR = DATA_DIR / "dem"


class SphericalHorizon:
    """Horizonte de la esfera lunar visto desde la superficie: 0° en todas direcciones.

    `margin_deg` exige que el cuerpo esté al menos esos grados sobre el
    horizonte para contarlo como visible (p. ej. margen para la antena).
    """

    kind = "esferico"

    def __init__(self, margin_deg: float = 0.0):
        self.margin_deg = float(margin_deg)

    def elevation(self, azimuth: np.ndarray) -> np.ndarray:
        return np.full(np.shape(azimuth), self.margin_deg, dtype=float)

    def clearance(self, azimuth: np.ndarray, elevation: np.ndarray) -> np.ndarray:
        """Grados por sobre el horizonte; positivo significa visible."""
        return np.asarray(elevation, dtype=float) - self.elevation(azimuth)

    def is_visible(self, azimuth: np.ndarray, elevation: np.ndarray) -> np.ndarray:
        return self.clearance(azimuth, elevation) > 0

    def sky_view_factor(self) -> float:
        """Computes the hemispherical Sky View Factor (SVF) in [0.0, 1.0].

        Uses SVF = (1/360) * sum(cos^2(max(0, h(az)))) over 1-degree azimuth bins.
        Lower SVF implies stronger natural ballistic shielding against grazing hazards.

        Returns:
            Sky View Factor in [0.0, 1.0].
        """
        az = np.arange(0.0, 360.0, 1.0)
        elev = np.maximum(0.0, self.elevation(az))
        return float(round(float(np.mean(np.cos(np.radians(elev)) ** 2)), 4))


class TerrainHorizon(SphericalHorizon):
    """Horizonte real del relieve, más el margen."""

    kind = "terreno"

    def __init__(self, mask: HorizonMask, margin_deg: float = 0.0):
        super().__init__(margin_deg)
        self.mask = mask
        # Se cierra el círculo para interpolar entre el último azimut y 360°.
        self._azimuths = np.append(mask.azimuths, 360.0)
        self._elevations = np.append(mask.elevation_deg, mask.elevation_deg[0])

    def elevation(self, azimuth: np.ndarray) -> np.ndarray:
        terrain = np.interp(np.asarray(azimuth, dtype=float) % 360.0, self._azimuths, self._elevations)
        return terrain + self.margin_deg


@lru_cache(maxsize=1)
def _dem() -> PolarDEM | None:
    return PolarDEM.open(DEM_DIR)


@lru_cache(maxsize=256)
def terrain_mask(site_id: str, lat: float, lon: float) -> HorizonMask | None:
    """Máscara precalculada del sitio, o calculada al vuelo; None si no hay datos de terreno."""
    path = MASKS_DIR / f"{site_id}.json"
    if path.exists():
        mask = HorizonMask.load(path)
        if abs(mask.lat - lat) < 1e-6 and abs(mask.lon - lon) < 1e-6:
            return mask
    dem = _dem()
    if dem is not None and PolarDEM.covers(lat):
        return compute_mask(dem, lat, lon)
    return None


def horizon_for(site: Site, margin_deg: float = 0.0) -> SphericalHorizon:
    """Horizonte a usar para un sitio: terreno si hay datos, esférico si no."""
    mask = terrain_mask(site.id, site.lat, site.lon)
    return TerrainHorizon(mask, margin_deg) if mask is not None else SphericalHorizon(margin_deg)
