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
- Global P = (wE·E + wC·C) / (wE + wC)

Todos los puntajes van de 0 a 100. El sitio es viable solo si al aterrizar
el Sol y la Tierra están sobre el horizonte.
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
    earth_margin_deg: float = EARTH_MARGIN_DEG
    weight_energy: float = 0.5
    weight_communication: float = 0.5
    weight_terrain: float = 1.0
    weight_protection: float = 0.5
    max_slope_deg: float = 15.0
    panel: str = "tiempo"

    def __post_init__(self) -> None:
        if self.panel not in PANELS:
            raise ValueError(f"unknown panel orientation: {self.panel}; options: {', '.join(PANELS)}")
        if self.window_days <= 0 or self.step_hours <= 0:
            raise ValueError("window_days and step_hours must be positive")
        if self.max_slope_deg <= 2.0:
            raise ValueError("max_slope_deg must be greater than 2.0 degrees")
        if (
            self.weight_energy < 0
            or self.weight_communication < 0
            or self.weight_terrain < 0
            or self.weight_protection < 0
        ):
            raise ValueError("weights cannot be negative")
        if self.weight_energy + self.weight_communication + self.weight_terrain + self.weight_protection == 0:
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
    """Complete landing site evaluation combining illumination, comms, terrain, and ballistic safety."""

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
    landing_ease_score: float = 0.0
    # None cuando no hay relieve real alrededor del sitio (horizonte esférico): "sin datos", no "0".
    asteroid_protection_score: float | None = None
    asteroid_score: float | None = None
    has_relief_data: bool = False
    sky_view_factor: float = 1.0
    solid_angle_shielded_pct: float | None = None
    horizon_shield_profile_deg: tuple[float, ...] = ()


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
) -> float:
    """Computes Evaluation A — Landing Ease Score on a 0-100 scale.

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
        Landing Ease Score rounded to 1 decimal place in [0.0, 100.0].
    """
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


def compute_terrain_score(terrain: TerrainMetrics, max_slope_deg: float = 15.0) -> float:
    """Backward-compatible alias for `compute_landing_ease_score`."""
    return compute_landing_ease_score(terrain, max_slope_deg=max_slope_deg)


def compute_tilt_incidence_factor(
    sun_el_deg: float,
    sun_az_deg: float,
    slope_deg: float,
    aspect_deg: float,
) -> float:
    """Computes cosine of the solar incidence angle on a terrain-tilted solar deck.

    Implements:
        cos(theta_i) = sin(el_sun)*cos(beta) + cos(el_sun)*sin(beta)*cos(az_sun - gamma)

    Args:
        sun_el_deg: Solar elevation above the local horizontal in degrees.
        sun_az_deg: Solar azimuth clockwise from North in degrees.
        slope_deg: Local terrain slope beta in degrees.
        aspect_deg: Downslope azimuth gamma in degrees.

    Returns:
        Clamped incidence factor in [0.0, 1.0].
    """
    el = np.radians(sun_el_deg)
    beta = np.radians(slope_deg)
    d_az = np.radians(sun_az_deg - aspect_deg)
    cos_i = float(np.sin(el) * np.cos(beta) + np.cos(el) * np.sin(beta) * np.cos(d_az))
    return max(0.0, min(1.0, cos_i))


def compute_asteroid_protection_score(ballistic_shield_raw: float, slope_deg: float) -> float:
    """Computes Evaluation B — Asteroid & Ejecta Protection Score in [0.0, 100.0].

    Physical basis: Natural ballistic shielding provided by surrounding mountains
    and crater rims against low-angle grazing meteoroid flux (NASA MEM3) and
    secondary impact ejecta curtains (5-40 deg). Steep local slopes (> 12 deg)
    incur a rockfall / mass-wasting penalty.

    Args:
        ballistic_shield_raw: Raw horizon shielding in [0.0, 100.0].
        slope_deg: Local terrain slope in degrees.

    Returns:
        Asteroid & ejecta protection score rounded to 1 decimal place in [0.0, 100.0].
    """
    rockfall_penalty = float(np.clip(1.0 - (slope_deg - 12.0) / 25.0, 0.3, 1.0)) if slope_deg > 12.0 else 1.0
    return round(float(np.clip(ballistic_shield_raw * rockfall_penalty, 0.0, 100.0)), 1)


def compute_asteroid_safety_score(sky_view_factor: float, roughness_m: float) -> float:
    """Backward-compatible proxy score for asteroid & ejecta safety in [0.0, 100.0]."""
    shielding = max(0.0, min(1.0, (1.0 - sky_view_factor) * 5.0))
    smoothness = max(0.0, 1.0 - roughness_m / 4.0)
    return round(100.0 * (0.4 * shielding + 0.6 * smoothness), 1)


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
    protection_score: float | None = None,
) -> float:
    """Computes the weighted overall landing site score P in [0.0, 100.0].

    Formula:
        P = (w_E * E + w_C * C + w_T * T_land + w_A * A_shield) / (w_E + w_C + w_T + w_A)

    Delegates to `weighted_general_score` so additional scoring pillars can be
    integrated without duplicating normalization logic.

    Args:
        energy: Energy score (E) in [0, 100].
        communication: Communication score (C) in [0, 100].
        config: Scoring configuration with component weights.
        terrain_score: Optional Evaluation A Landing Ease score in [0, 100].
        protection_score: Optional Evaluation B Asteroid Protection score in [0, 100].

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
        "protection": config.weight_protection,
    }
    if terrain_score is not None:
        scores_map["terrain"] = terrain_score
    if protection_score is not None:
        scores_map["protection"] = protection_score
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
    shielded_pct = base_horizon.solid_angle_shielded_pct()
    approach_pct = base_horizon.approach_clearance_pct(18.0)
    ballistic_raw = base_horizon.ballistic_shield_raw(15.0)
    profile_36 = tuple(base_horizon.horizon_profile_36())

    t_score = compute_landing_ease_score(resolved_terrain, config.max_slope_deg, approach_pct)
    # Sin máscara de horizonte con relieve (solo hay DEM al sur de 80° S) el blindaje no se puede
    # estimar: A queda sin datos y el puntaje global se renormaliza sin él.
    has_relief = base_horizon.kind == "terreno"
    a_score = compute_asteroid_protection_score(ballistic_raw, resolved_terrain.slope_deg) if has_relief else None
    if not has_relief:
        shielded_pct = None
        profile_36 = ()
    slope_ok = resolved_terrain.slope_deg <= config.max_slope_deg
    overall = total_score(
        energy,
        communication,
        config,
        terrain_score=t_score,
        protection_score=a_score,
    )
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
        landing_ease_score=t_score,
        asteroid_protection_score=a_score,
        asteroid_score=a_score,
        has_relief_data=has_relief,
        sky_view_factor=svf,
        solid_angle_shielded_pct=shielded_pct,
        horizon_shield_profile_deg=profile_36,
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
