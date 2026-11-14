"""Conversión de objetos del modelo a JSON para la API."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timedelta

import numpy as np

from app.models.horizon import SphericalHorizon, TerrainHorizon, horizon_for
from app.models.scoring import BodyMetrics, ScoringConfig, SiteEvaluation
from app.models.site import Site
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
