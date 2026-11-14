"""Puntaje de un sitio para una fecha de aterrizaje.

Se muestrea la posición del Sol y la Tierra durante la ventana de misión
(por defecto 14 días, aproximadamente la parte iluminada de un día lunar):

- Energía E = 50 % aprovechamiento solar de la ventana
              + 50 % horas continuas de luz desde el aterrizaje / horas de la ventana
  El aprovechamiento depende de la orientación de los paneles (`panel`):
    "tiempo"      fracción del tiempo con Sol visible, sin importar su altura
    "horizontal"  promedio de sen(elevación): paneles planos; premia el Sol alto
    "vertical"    promedio de cos(elevación): paneles verticales que giran hacia
                  el Sol, como en los módulos polares; premia el Sol bajo
- Comunicación C = fracción de la ventana con la Tierra visible
- Global P = (wE·E + wC·C) / (wE + wC)

Todos los puntajes van de 0 a 100. El sitio es viable solo si al aterrizar
el Sol y la Tierra están sobre el horizonte.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache

import numpy as np

from app.models.ephemeris import Ephemeris, Track
from app.models.horizon import horizon_for
from app.models.site import Site
from app.models.windows import (
    Interval,
    hours_until_rise,
    hours_until_set,
    visibility_intervals,
    visible_hours,
)


PANELS = ("tiempo", "horizontal", "vertical")


@dataclass(frozen=True)
class ScoringConfig:
    window_days: float = 14.0
    step_hours: float = 2.0
    sun_margin_deg: float = 0.0
    earth_margin_deg: float = 0.0
    weight_energy: float = 0.5
    weight_communication: float = 0.5
    panel: str = "tiempo"

    def __post_init__(self):
        if self.panel not in PANELS:
            raise ValueError(f"panel desconocido: {self.panel}; opciones: {', '.join(PANELS)}")
        if self.window_days <= 0 or self.step_hours <= 0:
            raise ValueError("window_days y step_hours deben ser positivos")
        if self.weight_energy < 0 or self.weight_communication < 0:
            raise ValueError("los pesos no pueden ser negativos")
        if self.weight_energy + self.weight_communication == 0:
            raise ValueError("al menos un peso debe ser mayor que cero")

    @property
    def window_hours(self) -> float:
        return self.window_days * 24.0


@dataclass(frozen=True)
class BodyMetrics:
    """Lo que se sabe de un cuerpo (Sol o Tierra) durante la ventana."""

    azimuth_deg: float  # al aterrizar
    elevation_deg: float  # al aterrizar
    visible: bool  # al aterrizar
    hours_until_set: float | None  # None: no se pone durante la ventana
    hours_until_rise: float | None  # None: no sale durante la ventana
    visible_hours: float
    visible_fraction: float
    max_elevation_deg: float
    mean_elevation_deg: float
    intervals: list[Interval]
    horizon: str


@dataclass(frozen=True)
class SiteEvaluation:
    site: Site
    landing: datetime
    config: ScoringConfig
    sun: BodyMetrics
    earth: BodyMetrics
    energy: float
    communication: float
    total: float
    viable: bool


def energy_score(solar_use: float, continuous_hours: float, window_hours: float) -> float:
    continuity = min(1.0, continuous_hours / window_hours)
    return 100.0 * (0.5 * solar_use + 0.5 * continuity)


def solar_use(track: Track, clearance: np.ndarray, panel: str) -> float:
    """Aprovechamiento solar promedio en la ventana (0 a 1) según la orientación de los paneles."""
    visible = clearance > 0
    elevation = np.radians(np.clip(track.elevation, 0.0, 90.0))
    if panel == "horizontal":
        factor = np.sin(elevation)
    elif panel == "vertical":
        factor = np.cos(elevation)
    else:
        factor = np.ones_like(elevation)
    return float(np.mean(np.where(visible, factor, 0.0)))


def communication_score(earth_fraction: float) -> float:
    return 100.0 * earth_fraction


def total_score(energy: float, communication: float, config: ScoringConfig) -> float:
    weights = config.weight_energy + config.weight_communication
    return (config.weight_energy * energy + config.weight_communication * communication) / weights


def body_metrics(track: Track, margin_deg: float, site: Site, window_hours: float) -> BodyMetrics:
    horizon = horizon_for(site, margin_deg)
    clearance = horizon.clearance(track.azimuth, track.elevation)
    intervals = visibility_intervals(track.hours, clearance)
    hours = visible_hours(intervals)
    return BodyMetrics(
        azimuth_deg=float(track.azimuth[0]),
        elevation_deg=float(track.elevation[0]),
        visible=bool(clearance[0] > 0),
        hours_until_set=hours_until_set(track.hours, clearance),
        hours_until_rise=hours_until_rise(track.hours, clearance),
        visible_hours=hours,
        visible_fraction=hours / window_hours,
        max_elevation_deg=float(np.max(track.elevation)),
        mean_elevation_deg=float(np.mean(track.elevation)),
        intervals=intervals,
        horizon=horizon.kind,
    )


def evaluate(ephemeris: Ephemeris, site: Site, landing: datetime,
             config: ScoringConfig = ScoringConfig()) -> SiteEvaluation:
    window_h = config.window_hours
    sun_track = ephemeris.track(site, "sun", landing, window_h, config.step_hours)
    earth_track = ephemeris.track(site, "earth", landing, window_h, config.step_hours)
    sun = body_metrics(sun_track, config.sun_margin_deg, site, window_h)
    earth = body_metrics(earth_track, config.earth_margin_deg, site, window_h)

    # Horas continuas de luz desde el aterrizaje; si el Sol no se pone, toda la ventana.
    if not sun.visible:
        continuous = 0.0
    elif sun.hours_until_set is None:
        continuous = window_h
    else:
        continuous = sun.hours_until_set

    if config.panel == "tiempo":
        use = sun.visible_fraction  # exacta, con los cruces interpolados
    else:
        horizon = horizon_for(site, config.sun_margin_deg)
        use = solar_use(sun_track, horizon.clearance(sun_track.azimuth, sun_track.elevation), config.panel)
    energy = energy_score(use, continuous, window_h)
    communication = communication_score(earth.visible_fraction)
    return SiteEvaluation(
        site=site,
        landing=sun_track.start,
        config=config,
        sun=sun,
        earth=earth,
        energy=energy,
        communication=communication,
        total=total_score(energy, communication, config),
        viable=sun.visible and earth.visible,
    )


@lru_cache(maxsize=128)
def evaluate_all(ephemeris: Ephemeris, sites: tuple[Site, ...], landing: datetime,
                 config: ScoringConfig = ScoringConfig()) -> tuple[SiteEvaluation, ...]:
    """Evalúa varios sitios para una fecha; el resultado queda en caché por (sitios, fecha, config)."""
    return tuple(evaluate(ephemeris, site, landing, config) for site in sites)
