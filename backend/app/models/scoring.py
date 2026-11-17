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
- Comunicación C = 50 % fracción de la ventana con la Tierra visible
                  + 50 % horas continuas de contacto desde el aterrizaje / horas de la ventana
  La Tierra cuenta como visible con su centro a `earth_margin_deg` sobre el
  horizonte (2° por defecto: margen de antena de NASA/TM-20220013310 §5.8.3,
  que además cubre el disco completo, de ~0,95° de radio).
- Global P = (wE·E + wC·C + wT·T) / (wE + wC + wT)

Terreno (T) se calcula a escala global mediante LOLA Global DEM y DEM polar.
Por defecto pesa 0 para mantener el modelo enfocado en la energía y la comunicación.

Todos los puntajes van de 0 a 100. El sitio es viable solo si al aterrizar
el Sol y la Tierra están sobre el horizonte y, si hay dato de pendiente, esta
no supera el límite.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
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
EARTH_MARGIN_DEG = 2.0
# Estancia en superficie que debe cubrir la luz continua: la NASA pide Sol durante toda la estancia
# del HLS y las 13 regiones de 2022 tienen sitios con ~6,5 días de luz continua (NASA, 19-08-2022).
STAY_DAYS = 6.5
# Pendiente máxima: 8° es el filtro de terreno de Wueller et al. (DEM de 20 m) y coincide con el umbral
# de orientación del HLS (HLS-R-0071), que es del vehículo y no una pendiente del terreno.
MAX_SLOPE_DEG = 8.0
CRITERIA = ("energy", "communication", "terrain")


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
        stay_days: Surface stay that continuous sunlight must cover for the site to be viable.
        panel: Solar panel orientation mode ("tiempo", "horizontal", or "vertical").
    """

    window_days: float = 14.0
    step_hours: float = 2.0
    sun_margin_deg: float = 0.0
    earth_margin_deg: float = EARTH_MARGIN_DEG
    weight_energy: float = 0.5
    weight_communication: float = 0.5
    weight_terrain: float = 0.0
    max_slope_deg: float = MAX_SLOPE_DEG
    stay_days: float = STAY_DAYS
    panel: str = "tiempo"

    def __post_init__(self) -> None:
        if self.panel not in PANELS:
            raise ValueError(f"unknown panel orientation: {self.panel}; options: {', '.join(PANELS)}")
        if self.window_days <= 0 or self.step_hours <= 0:
            raise ValueError("window_days and step_hours must be positive")
        if self.stay_days <= 0:
            raise ValueError("stay_days must be positive")
        if self.max_slope_deg <= 2.0:
            raise ValueError("max_slope_deg must be greater than 2.0 degrees")
        if (
            self.weight_energy < 0
            or self.weight_communication < 0
            or self.weight_terrain < 0
        ):
            raise ValueError("weights cannot be negative")
        if self.weight_energy + self.weight_communication + self.weight_terrain == 0:
            raise ValueError("at least one weight must be greater than zero")

    @property
    def window_hours(self) -> float:
        return self.window_days * 24.0

    @property
    def stay_hours(self) -> float:
        # La estancia no puede superar la ventana que se evalúa.
        return min(self.stay_days, self.window_days) * 24.0

    def weight(self, criterion: str) -> float:
        return float(getattr(self, f"weight_{criterion}"))


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
    """Complete landing site evaluation combining illumination, comms, terrain, and ballistic safety."""

    site: Site
    landing: datetime
    config: ScoringConfig
    sun: BodyMetrics
    earth: BodyMetrics
    energy: float
    communication: float
    terrain_score: float | None
    slope_deg: float | None
    roughness_m: float | None
    elevation_m: float | None
    slope_ok: bool | None
    terrain: TerrainMetrics
    total: float
    viable: bool
    landing_ease_score: float | None = None
    has_relief_data: bool = False
    sky_view_factor: float = 1.0
    # ¿Hay Sol continuo durante toda la estancia (config.stay_days) desde el aterrizaje?
    sun_through_stay: bool = False
    # Criterios con peso > 0 que no tienen dato en este sitio: el total se calculó sin ellos y no
    # es comparable con el de un sitio que sí los tiene.
    missing_criteria: tuple[str, ...] = ()


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


def communication_score(earth_fraction: float, continuous_hours: float, window_hours: float) -> float:
    continuity = min(1.0, continuous_hours / window_hours)
    return 100.0 * (0.5 * earth_fraction + 0.5 * continuity)


def continuous_hours(body: BodyMetrics, window_hours: float) -> float:
    """Horas seguidas con el cuerpo visible desde el aterrizaje; la ventana entera si no se pone."""
    if not body.visible:
        return 0.0
    if body.hours_until_set is None:
        return window_hours
    return body.hours_until_set


def compute_landing_ease_score(
    terrain: TerrainMetrics,
    max_slope_deg: float = 15.0,
    approach_clearance_pct: float = 100.0,
) -> float | None:
    """Computes Evaluation A — Landing Ease Score on a 0-100 scale, or None without slope data.

    Physical basis: near-field touchdown mechanical stability (Horn 3x3 slope
    and RMS roughness vs spacecraft tip-over limits) combined with final EDL
    approach glide-slope clearance (18 degrees).

    Sub-scores:
        - slope_subscore (65%): 100 if slope <= 2 deg, 0 if >= max_slope_deg, linear between.
        - roughness_subscore (25%): clip(100 * (1 - roughness_m / 5.0), 0, 100).
        - approach_subscore (10%): percentage of azimuths with horizon < 18 deg.

    If slope_deg > max_slope_deg, the score is capped at min(15.0, 0.25 * roughness_subscore).

    Args:
        terrain: Topographical metrics for the landing site.
        max_slope_deg: Critical lander tip-over slope limit in degrees.
        approach_clearance_pct: Percentage of 360-degree azimuths below 18 deg glide slope.

    Returns:
        Landing Ease Score rounded to 1 decimal place in [0.0, 100.0], or None.
    """
    if not terrain.available:
        return None
    if terrain.slope_deg <= 2.0:
        slope_sub = 100.0
    elif terrain.slope_deg >= max_slope_deg:
        slope_sub = 0.0
    else:
        slope_sub = 100.0 * (1.0 - (terrain.slope_deg - 2.0) / (max_slope_deg - 2.0))

    rough_sub = float(np.clip(100.0 * (1.0 - terrain.roughness_m / 5.0), 0.0, 100.0))
    approach_sub = float(np.clip(approach_clearance_pct, 0.0, 100.0))

    if terrain.slope_deg > max_slope_deg:
        return round(min(15.0, 0.25 * rough_sub), 1)
    return round(0.65 * slope_sub + 0.25 * rough_sub + 0.10 * approach_sub, 1)


def weighted_general_score(
    component_scores: dict[str, float],
    component_weights: dict[str, float],
) -> float:
    """Computes an extensible general weighted average across arbitrary scoring pillars.

    Each key present in `component_scores` is multiplied by its non-negative weight
    from `component_weights` (defaulting to 0.0 if omitted) and normalized by the
    sum of active weights.

    Args:
        component_scores: Mapping of pillar name to score in [0.0, 100.0].
        component_weights: Mapping of pillar name to non-negative weight.

    Returns:
        Normalized weighted score in [0.0, 100.0], or 0.0 if active weights sum to zero.
    """
    numerator = 0.0
    denominator = 0.0
    for key, value in component_scores.items():
        weight = max(0.0, float(component_weights.get(key, 0.0)))
        if weight > 0.0:
            numerator += weight * float(value)
            denominator += weight
    if denominator <= 0.0:
        return 0.0
    return float(np.clip(numerator / denominator, 0.0, 100.0))


def total_score(
    energy: float,
    communication: float,
    config: ScoringConfig,
    terrain_score: float | None = None,
) -> float:
    """Computes the weighted overall landing site score P in [0.0, 100.0].

    Formula:
        P = (w_E * E + w_C * C + w_T * T_land) / (w_E + w_C + w_T)

    Delegates to `weighted_general_score` so additional scoring pillars can be
    integrated without duplicating normalization logic.

    Args:
        energy: Energy score (E) in [0, 100].
        communication: Communication score (C) in [0, 100].
        config: Scoring configuration with component weights.
        terrain_score: Optional Evaluation A Landing Ease score in [0, 100].

    Returns:
        Weighted overall score in [0.0, 100.0], or 0.0 if total weight is zero.
    """
    scores_map: dict[str, float] = {
        "energy": energy,
        "communication": communication,
    }
    weights_map: dict[str, float] = {
        "energy": config.weight_energy,
        "communication": config.weight_communication,
        "terrain": config.weight_terrain,
    }
    if terrain_score is not None:
        scores_map["terrain"] = terrain_score
    return weighted_general_score(scores_map, weights_map)


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

    if config.panel == "tiempo":
        use = sun.visible_fraction  # exact, with interpolated crossings
    else:
        horizon = horizon_for(site, config.sun_margin_deg)
        use = solar_use(sun_track, horizon.clearance(sun_track.azimuth, sun_track.elevation), config.panel)
    energy = energy_score(use, continuous_hours(sun, window_h), window_h)
    communication = communication_score(earth.visible_fraction, continuous_hours(earth, window_h), window_h)

    resolved_terrain = terrain or getattr(site, "terrain", None) or evaluate_terrain(site.lat, site.lon)
    base_horizon = horizon_for(site, 0.0)
    svf = base_horizon.sky_view_factor()
    approach_pct = base_horizon.approach_clearance_pct(18.0)

    t_score = compute_landing_ease_score(resolved_terrain, config.max_slope_deg, approach_pct)
    has_relief = base_horizon.kind == "terreno"
    slope_ok = resolved_terrain.slope_deg <= config.max_slope_deg if resolved_terrain.available else None
    overall = total_score(
        energy,
        communication,
        config,
        terrain_score=t_score,
    )
    # Viable: Sol y Tierra a la vista al aterrizar, luz continua durante toda la estancia y
    # pendiente bajo el límite (si hay dato de pendiente).
    sun_through_stay = bool(continuous_hours(sun, window_h) >= config.stay_hours)
    viable = bool(sun.visible and earth.visible and sun_through_stay and slope_ok is not False)
    available = {"energy": True, "communication": True, "terrain": t_score is not None}
    missing = tuple(c for c in CRITERIA if config.weight(c) > 0 and not available[c])

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
        landing_ease_score=t_score,
        has_relief_data=has_relief,
        sky_view_factor=svf,
        sun_through_stay=sun_through_stay,
        missing_criteria=missing,
    )


@lru_cache(maxsize=128)
def evaluate_all(ephemeris: Ephemeris, sites: tuple[Site, ...], landing: datetime,
                 config: ScoringConfig = ScoringConfig()) -> tuple[SiteEvaluation, ...]:
    """Evalúa varios sitios para una fecha; el resultado queda en caché por (sitios, fecha, config)."""
    return tuple(evaluate(ephemeris, site, landing, config) for site in sites)


MAX_CANDIDATES = 400


def best_dates(ephemeris: Ephemeris, site: Site, start: datetime, days: float, step_hours: float,
               config: ScoringConfig = ScoringConfig(), limit: int = 5) -> tuple[int, list[SiteEvaluation]]:
    """Evalúa fechas de aterrizaje cada `step_hours` durante `days` desde `start`.

    Devuelve (cantidad evaluada, las `limit` mejores): primero las viables y,
    entre ellas, las de mayor puntaje global; ante empate, la más temprana.
    """
    count = int(days * 24 / step_hours) + 1
    if count > MAX_CANDIDATES:
        raise ValueError(f"demasiadas fechas a evaluar ({count}); máximo {MAX_CANDIDATES}: "
                         "reduce 'days' o aumenta 'step_hours'")
    candidates = [
        evaluate(ephemeris, site, start + timedelta(hours=i * step_hours), config)
        for i in range(count)
    ]
    ranked = sorted(candidates, key=lambda r: (not r.viable, -round(r.total, 1), r.landing))
    return count, ranked[:limit]


def failing_requirements(result: SiteEvaluation) -> tuple[str, ...]:
    """Requisitos duros que no cumple una evaluación: "sun", "earth" y/o "slope".

    "sun": el Sol no está a la vista al aterrizar o no dura toda la estancia.
    "earth": la Tierra no está a la vista al aterrizar.
    "slope": la pendiente medida supera el límite (sin dato de pendiente no falla).
    """
    failing = []
    if not result.sun.visible or not result.sun_through_stay:
        failing.append("sun")
    if not result.earth.visible:
        failing.append("earth")
    if result.slope_ok is False:
        failing.append("slope")
    return tuple(failing)


def availability(ephemeris: Ephemeris, site: Site, start: datetime, days: float, step_hours: float,
                 config: ScoringConfig = ScoringConfig()) -> list[SiteEvaluation]:
    """Evalúa una fecha de aterrizaje cada `step_hours` durante `days`, en orden cronológico.

    Responde "¿cuántas de las fechas posibles cumplen todos los requisitos?": la disponibilidad de
    misión (solo la parte de superficie; lanzamiento y órbita quedan fuera).
    """
    count = int(days * 24 / step_hours) + 1
    if count > MAX_CANDIDATES:
        raise ValueError(f"demasiadas fechas a evaluar ({count}); máximo {MAX_CANDIDATES}: "
                         "reduce 'days' o aumenta 'step_hours'")
    return [evaluate(ephemeris, site, start + timedelta(hours=i * step_hours), config) for i in range(count)]
