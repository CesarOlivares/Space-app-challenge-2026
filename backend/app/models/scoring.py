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
from app.models.terrain import TerrainMetrics, evaluate_terrain
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
    """Configuration parameters for lunar landing site evaluation.

    Attributes:
        window_days: Mission evaluation window duration in days.
        step_hours: Sampling interval in hours.
        sun_margin_deg: Minimum required solar elevation above horizon in degrees.
        earth_margin_deg: Minimum required Earth elevation above horizon in degrees.
        weight_energy: Relative weight for the Energy score (E).
        weight_communication: Relative weight for the Communication score (C).
        weight_terrain: Relative weight for the Terrain & Landing Safety score (T).
        max_slope_deg: Critical lander tip-over slope limit in degrees.
        panel: Solar panel orientation mode ("tiempo", "horizontal", or "vertical").
    """

    window_days: float = 14.0
    step_hours: float = 2.0
    sun_margin_deg: float = 0.0
    earth_margin_deg: float = 0.0
    weight_energy: float = 0.5
    weight_communication: float = 0.5
    weight_terrain: float = 1.0
    max_slope_deg: float = 15.0
    panel: str = "tiempo"

    def __post_init__(self) -> None:
        if self.panel not in PANELS:
            raise ValueError(f"unknown panel orientation: {self.panel}; options: {', '.join(PANELS)}")
        if self.window_days <= 0 or self.step_hours <= 0:
            raise ValueError("window_days and step_hours must be positive")
        if self.max_slope_deg <= 2.0:
            raise ValueError("max_slope_deg must be greater than 2.0 degrees")
        if self.weight_energy < 0 or self.weight_communication < 0 or self.weight_terrain < 0:
            raise ValueError("weights cannot be negative")
        if self.weight_energy + self.weight_communication + self.weight_terrain == 0:
            raise ValueError("at least one weight must be greater than zero")

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
    """Complete landing site evaluation combining illumination, comms, and terrain safety."""

    site: Site
    landing: datetime
    config: ScoringConfig
    sun: BodyMetrics
    earth: BodyMetrics
    energy: float
    communication: float
    terrain_score: float
    slope_deg: float
    roughness_m: float
    elevation_m: float
    slope_ok: bool
    terrain: TerrainMetrics
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


def compute_terrain_score(terrain: TerrainMetrics, max_slope_deg: float = 15.0) -> float:
    """Computes the Topography & Landing Safety score (T) on a 0-100 scale.

    Combines a slope sub-score (70% weight) and a surface roughness sub-score
    (30% weight):
        - slope_deg <= 2.0 deg -> S_slope = 100.0
        - slope_deg >= max_slope_deg -> S_slope = 0.0
        - 2.0 < slope_deg < max_slope_deg -> linear decay from 100.0 to 0.0
        - S_rough = max(0.0, 100.0 * (1.0 - roughness_m / 5.0))

    If slope_deg exceeds max_slope_deg, the combined score is capped at
    min(15.0, 0.3 * S_rough).

    Args:
        terrain: Topographical metrics for the landing site.
        max_slope_deg: Critical lander tip-over slope limit in degrees.

    Returns:
        Terrain safety score rounded to 1 decimal place in [0.0, 100.0].
    """
    if terrain.slope_deg <= 2.0:
        slope_sub = 100.0
    elif terrain.slope_deg >= max_slope_deg:
        slope_sub = 0.0
    else:
        slope_sub = 100.0 * (1.0 - (terrain.slope_deg - 2.0) / (max_slope_deg - 2.0))

    rough_sub = max(0.0, 100.0 * (1.0 - terrain.roughness_m / 5.0))

    if terrain.slope_deg > max_slope_deg:
        return round(min(15.0, 0.3 * rough_sub), 1)
    return round(0.7 * slope_sub + 0.3 * rough_sub, 1)


def total_score(
    energy: float,
    communication: float,
    config: ScoringConfig,
    terrain_score: float | None = None,
) -> float:
    """Computes the weighted overall landing site score P in [0.0, 100.0].

    Formula:
        P = (w_E * E + w_C * C + w_T * T) / (w_E + w_C + w_T)

    When `terrain_score` is omitted (None), falls back to the legacy two-term
    weighted average over Energy and Communication for backward compatibility.

    Args:
        energy: Energy score (E) in [0, 100].
        communication: Communication score (C) in [0, 100].
        config: Scoring configuration with component weights.
        terrain_score: Optional Terrain & Landing Safety score (T) in [0, 100].

    Returns:
        Weighted overall score in [0.0, 100.0], or 0.0 if total weight is zero.
    """
    if terrain_score is None:
        weights = config.weight_energy + config.weight_communication
        if weights <= 0.0:
            return 0.0
        return (config.weight_energy * energy + config.weight_communication * communication) / weights

    weights = config.weight_energy + config.weight_communication + config.weight_terrain
    if weights <= 0.0:
        return 0.0
    return (
        config.weight_energy * energy
        + config.weight_communication * communication
        + config.weight_terrain * terrain_score
    ) / weights


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


def evaluate(
    ephemeris: Ephemeris,
    site: Site,
    landing: datetime,
    config: ScoringConfig = ScoringConfig(),
    terrain: TerrainMetrics | None = None,
) -> SiteEvaluation:
    """Evaluates a lunar landing site at a given landing epoch.

    Combines solar illumination (Energy), Earth line-of-sight (Communication),
    and surface topography (Terrain & Landing Safety) into a unified score and
    landing viability decision.

    Args:
        ephemeris: Loaded JPL ephemeris instance.
        site: Target landing site.
        landing: Landing epoch (UTC or naive treated as UTC).
        config: Scoring and safety configuration parameters.
        terrain: Optional pre-resolved TerrainMetrics; evaluated from coordinates if None.

    Returns:
        Immutable SiteEvaluation containing all sub-scores, metrics, and viability.
    """
    window_h = config.window_hours
    sun_track = ephemeris.track(site, "sun", landing, window_h, config.step_hours)
    earth_track = ephemeris.track(site, "earth", landing, window_h, config.step_hours)
    sun = body_metrics(sun_track, config.sun_margin_deg, site, window_h)
    earth = body_metrics(earth_track, config.earth_margin_deg, site, window_h)

    # Continuous sunlight hours from landing; full window if the Sun never sets.
    if not sun.visible:
        continuous = 0.0
    elif sun.hours_until_set is None:
        continuous = window_h
    else:
        continuous = sun.hours_until_set

    if config.panel == "tiempo":
        use = sun.visible_fraction  # exact, with interpolated crossings
    else:
        horizon = horizon_for(site, config.sun_margin_deg)
        use = solar_use(sun_track, horizon.clearance(sun_track.azimuth, sun_track.elevation), config.panel)
    energy = energy_score(use, continuous, window_h)
    communication = communication_score(earth.visible_fraction)

    resolved_terrain = terrain or getattr(site, "terrain", None) or evaluate_terrain(site.lat, site.lon)
    t_score = compute_terrain_score(resolved_terrain, config.max_slope_deg)
    slope_ok = resolved_terrain.slope_deg <= config.max_slope_deg
    overall = total_score(energy, communication, config, terrain_score=t_score)
    viable = bool(sun.visible and earth.visible and slope_ok)

    return SiteEvaluation(
        site=site,
        landing=sun_track.start,
        config=config,
        sun=sun,
        earth=earth,
        energy=energy,
        communication=communication,
        terrain_score=t_score,
        slope_deg=resolved_terrain.slope_deg,
        roughness_m=resolved_terrain.roughness_m,
        elevation_m=resolved_terrain.elevation_m,
        slope_ok=slope_ok,
        terrain=resolved_terrain,
        total=overall,
        viable=viable,
    )


@lru_cache(maxsize=128)
def evaluate_all(ephemeris: Ephemeris, sites: tuple[Site, ...], landing: datetime,
                 config: ScoringConfig = ScoringConfig()) -> tuple[SiteEvaluation, ...]:
    """Evalúa varios sitios para una fecha; el resultado queda en caché por (sitios, fecha, config)."""
    return tuple(evaluate(ephemeris, site, landing, config) for site in sites)
