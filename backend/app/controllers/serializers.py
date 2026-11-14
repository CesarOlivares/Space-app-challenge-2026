"""Conversión de objetos del modelo a JSON para la API."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta

import numpy as np

from app.models.horizon import SphericalHorizon, TerrainHorizon, horizon_for
from app.models.scoring import BodyMetrics, ScoringConfig, SiteEvaluation
from app.models.site import Site
from app.models.terrain import TerrainCutout
from app.models.windows import Interval


def iso(when: datetime) -> str:
    return when.isoformat(timespec="seconds").replace("+00:00", "Z")


def at_offset(start: datetime, hours: float | None) -> str | None:
    return None if hours is None else iso(start + timedelta(hours=hours))


def site_json(site: Site) -> dict:
    data = asdict(site)
    data["source"] = {"name": data.pop("source_name"), "url": data.pop("source_url")}
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
    data = {
        "site_id": result.site.id,
        "date": iso(result.landing),
        "viable": result.viable,
        "scores": {
            "energy": round(result.energy, 1),
            "communication": round(result.communication, 1),
            "total": round(result.total, 1),
        },
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
