"""Temperatura de la superficie a lo largo de la estancia, estimada desde la iluminación.

Es un modelo de primer orden, no una simulación térmica: una sola capa de regolito que recibe
el Sol según su altura y pierde calor por radiación.

    C · dT/dt = (1 − A) · S · sen(h) · [Sol visible] + Q − ε · σ · T⁴

- A = 0,12 (albedo), ε = 0,95 (emisividad) y S = 1361 W/m² (constante solar a 1 UA).
- C es la capacidad térmica por área de la capa que sigue el ciclo día-noche. Se ajustó para
  que una noche ecuatorial de 14,75 días termine cerca de 95 K, como mide Diviner
  (Williams et al. 2017, doi:10.1016/j.icarus.2016.08.012).
- Q es el piso de calor (flujo interno y luz reflejada por el relieve vecino): fija el
  equilibrio en sombra larga en ~40 K, el orden de las regiones en sombra permanente
  (Paige et al. 2010, doi:10.1126/science.1187726).

Supone superficie horizontal y no modela el calor que irradian las laderas vecinas, que en
los cráteres polares es la fuente principal: ahí el valor es una cota inferior.
"""

from __future__ import annotations

import numpy as np

ALBEDO = 0.12
EMISSIVITY = 0.95
SOLAR_CONSTANT_W_M2 = 1361.0
STEFAN_BOLTZMANN = 5.670374e-8
HEAT_CAPACITY_J_M2K = 1.76e5
FLOOR_TEMPERATURE_K = 40.0
# El hielo de agua es estable por miles de millones de años bajo ~110 K (Paige et al. 2010).
ICE_STABILITY_K = 110.0

_RADIATIVE = EMISSIVITY * STEFAN_BOLTZMANN
_FLOOR_FLUX = _RADIATIVE * FLOOR_TEMPERATURE_K ** 4


def equilibrium_temperature(sun_elevation_deg: np.ndarray | float) -> np.ndarray:
    """Temperatura (K) de una superficie horizontal en equilibrio con el Sol a esa altura."""
    sine = np.clip(np.sin(np.radians(np.asarray(sun_elevation_deg, dtype=float))), 0.0, 1.0)
    absorbed = (1 - ALBEDO) * SOLAR_CONSTANT_W_M2 * sine + _FLOOR_FLUX
    return (absorbed / _RADIATIVE) ** 0.25


def temperature_series(hours: np.ndarray, sun_elevation_deg: np.ndarray, sun_visible: np.ndarray,
                       initial_k: float | None = None) -> np.ndarray:
    """Temperatura (K) en cada instante de `hours`, integrando el balance de calor.

    `sun_visible` ya considera el relieve: con el Sol tapado solo queda el piso de calor.
    Sin `initial_k` se parte del equilibrio del primer instante.
    """
    hours = np.asarray(hours, dtype=float)
    lit = np.asarray(sun_visible, dtype=bool)
    target = np.where(lit, equilibrium_temperature(sun_elevation_deg), FLOOR_TEMPERATURE_K)
    out = np.empty(hours.size)
    temperature = float(target[0] if initial_k is None else initial_k)
    out[0] = temperature
    for i in range(1, hours.size):
        remaining = (hours[i] - hours[i - 1]) * 3600.0
        absorbed = _RADIATIVE * 0.5 * (target[i - 1] ** 4 + target[i] ** 4)
        # Pasos cortos: con Sol alto la superficie responde en minutos y un paso largo sería inestable.
        while remaining > 0:
            rate = (absorbed - _RADIATIVE * temperature ** 4) / HEAT_CAPACITY_J_M2K
            limit = HEAT_CAPACITY_J_M2K / (256 * _RADIATIVE * max(temperature, FLOOR_TEMPERATURE_K) ** 3)
            dt = min(remaining, limit)
            temperature = max(FLOOR_TEMPERATURE_K, temperature + rate * dt)
            remaining -= dt
        out[i] = temperature
    return out
