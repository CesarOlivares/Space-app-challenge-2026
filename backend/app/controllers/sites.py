from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.controllers.deps import coarse_config, fine_config, get_catalog, get_ephemeris, landing_date, resolve_site
from app.controllers.serializers import at_offset, evaluation_json, interval_json, iso, site_json
from app.models.ephemeris import BODIES, Ephemeris
from app.models.horizon import horizon_for
from app.models.scoring import ScoringConfig, best_dates, evaluate
from app.models.site import Site
from app.models.windows import visibility_intervals

router = APIRouter(prefix="/api/sites", tags=["sitios"])

MAX_TIMELINE_POINTS = 5000


@router.get("")
def list_sites(catalog: dict[str, Site] = Depends(get_catalog)) -> dict:
    """Catálogo de sitios curados."""
    return {"sites": [site_json(site) for site in catalog.values()]}


@router.get("/{site_ref}/sky")
def sky(
    site_ref: str,
    date: datetime = Depends(landing_date),
    config: ScoringConfig = Depends(fine_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Sol y Tierra sobre el horizonte del sitio, tiempos hasta el ocaso y métricas de la ventana."""
    site = resolve_site(site_ref, catalog)
    return evaluation_json(evaluate(ephemeris, site, date, config), detailed=True)


@router.get("/{site_ref}/timeline")
def timeline(
    site_ref: str,
    date: datetime = Depends(landing_date),
    days: float = Query(14.0, gt=0, le=60, description="Duración de la serie"),
    step_hours: float = Query(1.0, ge=0.25, le=24, description="Paso entre muestras"),
    sun_margin_deg: float = Query(0.0, ge=-5, le=30),
    earth_margin_deg: float = Query(0.0, ge=-5, le=30),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Serie temporal de azimut y elevación del Sol y la Tierra, con sus ventanas de visibilidad."""
    if days * 24 / step_hours + 1 > MAX_TIMELINE_POINTS:
        raise ValueError(
            f"demasiados puntos: reduce 'days' o aumenta 'step_hours' (máximo {MAX_TIMELINE_POINTS})"
        )
    site = resolve_site(site_ref, catalog)
    margins = {"sun": sun_margin_deg, "earth": earth_margin_deg}

    series = {}
    for body in BODIES:
        track = ephemeris.track(site, body, date, days * 24, step_hours)
        horizon = horizon_for(site, margins[body])
        clearance = horizon.clearance(track.azimuth, track.elevation)
        series[body] = {
            "azimuth_deg": [round(v, 3) for v in track.azimuth.tolist()],
            "elevation_deg": [round(v, 3) for v in track.elevation.tolist()],
            "horizon_deg": [round(v, 3) for v in horizon.elevation(track.azimuth).tolist()],
            "windows": [interval_json(i, track.start)
                        for i in visibility_intervals(track.hours, clearance)],
            "horizon": horizon.kind,
        }

    return {
        "site": site_json(site),
        "start": iso(track.start),
        "step_hours": step_hours,
        "times": [at_offset(track.start, h) for h in track.hours.tolist()],
        **series,
    }


@router.get("/{site_ref}/best-dates")
def best_landing_dates(
    site_ref: str,
    date: datetime = Depends(landing_date),
    days: float = Query(30.0, gt=0, le=60, description="Cuántos días buscar desde `date`"),
    step_hours: float = Query(6.0, ge=1, le=48, description="Separación entre fechas candidatas"),
    limit: int = Query(5, ge=1, le=20),
    config: ScoringConfig = Depends(coarse_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Mejores fechas de aterrizaje de un sitio dentro de un rango (RF-18)."""
    site = resolve_site(site_ref, catalog)
    evaluated, results = best_dates(ephemeris, site, date, days, step_hours, config, limit)
    return {
        "site": site_json(site),
        "start": iso(date),
        "days": days,
        "step_hours": step_hours,
        "evaluated": evaluated,
        "results": [evaluation_json(r, detailed=False) for r in results],
    }
