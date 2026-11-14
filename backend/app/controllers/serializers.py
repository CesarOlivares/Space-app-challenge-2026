"""Conversión de objetos del modelo a JSON para la API."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta

import numpy as np

from app.models.horizon import SphericalHorizon, TerrainHorizon, horizon_for
from app.models.scoring import BodyMetrics, ScoringConfig, SiteEvaluation
from app.models.site import Site
from app.models.terrain import TerrainCutout, TerrainMetrics, evaluate_terrain
from app.models.windows import Interval


def iso(when: datetime) -> str:
    return when.isoformat(timespec="seconds").replace("+00:00", "Z")


def at_offset(start: datetime, hours: float | None) -> str | None:
    return None if hours is None else iso(start + timedelta(hours=hours))


def topography_json(
    terrain: TerrainMetrics,
    slope_ok: bool | None = None,
    sky_view_factor: float | None = None,
    solid_angle_shielded_pct: float | None = None,
    landing_ease_score: float | None = None,
    asteroid_protection_score: float | None = None,
    horizon_shield_profile_deg: tuple[float, ...] | list[float] | None = None,
) -> dict:
    """Serializes TerrainMetrics and dual hazard metrics into the API topography payload.

    Args:
        terrain: Evaluated terrain metrics for a site.
        slope_ok: Optional lander slope safety boolean against max_slope_deg.
        sky_view_factor: Optional hemispherical sky visibility factor in [0, 1].
        solid_angle_shielded_pct: Optional percentage of upper hemisphere blocked by mountains.
        landing_ease_score: Optional Evaluation A score in [0, 100].
        asteroid_protection_score: Optional Evaluation B score in [0, 100].
        horizon_shield_profile_deg: Optional 36-azimuth horizon elevation profile in degrees.

    Returns:
        Dictionary containing elevation, slope, roughness, aspect, SVF, shielding, and scores.
    """
    payload = {
        "elevation_m": _round(terrain.elevation_m, 1),
        "slope_deg": _round(terrain.slope_deg, 2),
        "roughness_m": _round(terrain.roughness_m, 2),
        "aspect_deg": _round(terrain.aspect_deg, 1),
        "sky_view_factor": round(sky_view_factor if sky_view_factor is not None else terrain.sky_view_factor, 4),
        "source": terrain.source,
    }
    if slope_ok is not None:
        payload["slope_ok"] = slope_ok
    if solid_angle_shielded_pct is not None:
        payload["solid_angle_shielded_pct"] = round(solid_angle_shielded_pct, 2)
    if landing_ease_score is not None:
        payload["landing_ease_score"] = round(landing_ease_score, 1)
    if asteroid_protection_score is not None:
        payload["asteroid_protection_score"] = round(asteroid_protection_score, 1)
    if horizon_shield_profile_deg is not None:
        payload["horizon_shield_profile_deg"] = [round(float(v), 2) for v in horizon_shield_profile_deg]
    return payload


def site_json(site: Site) -> dict:
    """Serializes a Site dataclass into a JSON-compatible dictionary with topography."""
    data = asdict(site)
    data.pop("terrain", None)
    data["source"] = {"name": data.pop("source_name"), "url": data.pop("source_url")}
    terrain = site.terrain or evaluate_terrain(site.lat, site.lon)
    data["topography"] = topography_json(terrain)
    return data


def config_json(config: ScoringConfig) -> dict:
    return asdict(config)


def interval_json(interval: Interval, start: datetime) -> dict:
    return {
        "start": at_offset(start, interval.start_h),
        "end": at_offset(start, interval.end_h),
        "duration_hours": round(interval.duration_h, 3),
        "open_start": interval.open_start,
        "open_end": interval.open_end,
    }


def _round(value: float | None, digits: int = 3) -> float | None:
    return None if value is None else round(value, digits)


def body_json(body: BodyMetrics, start: datetime, detailed: bool) -> dict:
    data = {
        "azimuth_deg": _round(body.azimuth_deg),
        "elevation_deg": _round(body.elevation_deg),
        "visible": body.visible,
    }
    if detailed:
        data.update({
            "hours_until_set": _round(body.hours_until_set),
            "set_time": at_offset(start, body.hours_until_set),
            "hours_until_rise": _round(body.hours_until_rise),
            "rise_time": at_offset(start, body.hours_until_rise),
            "visible_hours": _round(body.visible_hours),
            "visible_fraction": _round(body.visible_fraction, 4),
            "max_elevation_deg": _round(body.max_elevation_deg),
            "mean_elevation_deg": _round(body.mean_elevation_deg),
            "windows": [interval_json(i, start) for i in body.intervals],
            "horizon": body.horizon,
        })
    return data


def evaluation_json(result: SiteEvaluation, detailed: bool) -> dict:
    """Serializes a SiteEvaluation into the REST API response format."""
    data = {
        "site_id": result.site.id,
        "date": iso(result.landing),
        "viable": result.viable,
        "scores": {
            "energy": round(result.energy, 1),
            "communication": round(result.communication, 1),
            "landing_ease": _round(result.landing_ease_score, 1),
            "asteroid_protection": _round(result.asteroid_protection_score, 1),
            "terrain": _round(result.landing_ease_score, 1),
            "asteroid": _round(result.asteroid_protection_score, 1),
            "total": round(result.total, 1),
        },
        "topography": topography_json(
            result.terrain,
            slope_ok=result.slope_ok,
            sky_view_factor=result.sky_view_factor,
            solid_angle_shielded_pct=result.solid_angle_shielded_pct,
            landing_ease_score=result.landing_ease_score,
            asteroid_protection_score=result.asteroid_protection_score,
            horizon_shield_profile_deg=result.horizon_shield_profile_deg,
        ),
        "sun": body_json(result.sun, result.landing, detailed),
        "earth": body_json(result.earth, result.landing, detailed),
    }
    if detailed:
        data["site"] = site_json(result.site)
        data["config"] = config_json(result.config)
        data["horizon"] = horizon_json(horizon_for(result.site))
    return data


def horizon_json(horizon: SphericalHorizon) -> dict:
    """Tipo de horizonte y, si es por terreno, su perfil cada 1° de azimut (sin margen)."""
    if not isinstance(horizon, TerrainHorizon):
        return {"kind": horizon.kind, "profile_deg": None}
    mask = horizon.mask
    profile = TerrainHorizon(mask).elevation(np.arange(0, 360, 1.0))
    return {
        "kind": horizon.kind,
        "source": mask.source,
        "observer_height_m": mask.observer_height_m,
        "max_distance_km": mask.max_distance_km,
        "profile_deg": [round(v, 2) for v in profile.tolist()],
    }


def cutout_json(
    cutout: TerrainCutout,
    site: Site,
    include_slopes: bool = True,
    format_mode: str = "json",
) -> dict:
    """Serialización optimizada de un recorte de terreno LOLA para WebGL / Three.js."""
    data = {
        "site": site_json(site),
        "grid": {
            "width": cutout.width,
            "height": cutout.height,
            "step_m": cutout.step_m,
            "extent_km": cutout.extent_km,
            "center_elevation_m": cutout.center_elevation_m,
            "min_elevation_m": cutout.min_elevation_m,
            "max_elevation_m": cutout.max_elevation_m,
            "mean_slope_deg": cutout.mean_slope_deg,
            "max_slope_deg": cutout.max_slope_deg,
            "safe_landing_fraction": cutout.safe_landing_fraction,
            "source": cutout.source,
        },
    }
    if format_mode == "base64":
        import base64

        data["elevations_b64"] = base64.b64encode(cutout.elevations_m.tobytes()).decode("ascii")
        if include_slopes:
            data["slopes_b64"] = base64.b64encode(cutout.slopes_deg.tobytes()).decode("ascii")
    else:
        data["elevations_m"] = [round(float(v), 1) for v in cutout.elevations_m.ravel()]
        if include_slopes:
            data["slopes_deg"] = [round(float(v), 1) for v in cutout.slopes_deg.ravel()]
    return data
