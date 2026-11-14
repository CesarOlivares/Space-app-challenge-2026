"""Elevación del horizonte local según el azimut.

Sin atmósfera, el horizonte lo fijan el terreno y la curvatura de la esfera.
Por ahora solo existe el horizonte esférico; en la fase 7 se agrega la
máscara de terreno LOLA para los sitios del polo sur.
"""

from __future__ import annotations

import numpy as np

from app.models.site import Site


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


def horizon_for(site: Site, margin_deg: float = 0.0) -> SphericalHorizon:
    """Horizonte a usar para un sitio."""
    return SphericalHorizon(margin_deg)
