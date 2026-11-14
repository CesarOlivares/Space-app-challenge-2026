from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.controllers.deps import coarse_config, fine_config, get_catalog, get_ephemeris, landing_date, resolve_site
from app.controllers.serializers import at_offset, cutout_json, evaluation_json, interval_json, iso, site_json
from app.models.ephemeris import BODIES, Ephemeris
from app.models.horizon import get_dem, horizon_for
from app.models.scoring import ScoringConfig, best_dates, evaluate
from app.models.site import Site
from app.models.terrain import evaluate_terrain_patch
from app.models.windows import visibility_intervals

router = APIRouter(prefix="/api/sites", tags=["sitios"])

MAX_TIMELINE_POINTS = 5000


@router.get("")
def list_sites(catalog: dict[str, Site] = Depends(get_catalog)) -> dict:
    """Returns the curated catalog of lunar landing sites with topography metadata."""
    return {"sites": [site_json(site) for site in catalog.values()]}


@router.get("/{site_ref}/sky")
def sky(
    site_ref: str,
    date: datetime = Depends(landing_date),
    config: ScoringConfig = Depends(fine_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Returns Sun/Earth visibility, horizon profile, terrain safety score, and topography metrics for a site."""
    site = resolve_site(site_ref, catalog)
    return evaluation_json(evaluate(ephemeris, site, date, config), detailed=True)


@router.get("/{site_ref}/patch")
def terrain_patch(
    site_ref: str,
    size: int = Query(25, ge=5, le=51, description="Odd grid dimension (e.g. 25 for 25x25 cells)"),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Returns a local NxN elevation and slope grid around the landing site for 3D relief inspection."""
    if size % 2 == 0:
        raise ValueError("size must be an odd integer")
    site = resolve_site(site_ref, catalog)
    patch = evaluate_terrain_patch(site.lat, site.lon, size=size)
    return {"site_id": site.id, **patch}


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


@router.get("/{site_ref}/terrain", response_model=None)
def terrain_cutout(
    site_ref: str,
    response: Response,
    size: int = Query(128, ge=32, le=512, description="Dimensiones de la grilla cuadrada (ancho y alto en píxeles)"),
    step: int = Query(1, ge=1, le=8, description="Paso de muestreo en píxeles del DEM (1 = 120 m/px, 2 = 240 m/px...)"),
    format: Literal["json", "base64", "binary"] = Query("json", description="Formato de entrega: json, base64 o binary"),
    include_slopes: bool = Query(True, description="Si incluye el mapa y métricas de pendientes"),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> Response | dict:
    """Recorte de relieve 3D LOLA y mapa de pendientes centrado en el sitio (polo sur lunar)."""
    site = resolve_site(site_ref, catalog)
    dem = get_dem()
    if dem is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo de elevación polar LOLA no disponible en el servidor. Ejecuta ./run.sh data --dem",
        )

    extent_km = (size * step * 120.0) / 1000.0
    radius_km = extent_km / 2.0
    if not dem.covers(site.lat, radius_km):
        raise HTTPException(
            status_code=422,
            detail=f"El sitio '{site.name}' ({site.lat:.2f}°) está fuera de la cobertura del DEM polar LOLA "
                   f"(requiere lat <= -79.95° para radio de {radius_km:.1f} km).",
        )

    cutout = dem.cutout(site.lat, site.lon, size_px=size, step=step)

    # El relieve lunar es estático: respuesta inmutable en caché de cliente
    response.headers["Cache-Control"] = "public, max-age=86400, immutable"

    if format == "binary":
        headers = {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "public, max-age=86400, immutable",
            "X-Grid-Width": str(cutout.width),
            "X-Grid-Height": str(cutout.height),
            "X-Grid-Step-Meters": str(cutout.step_m),
            "X-Min-Elevation": str(cutout.min_elevation_m),
            "X-Max-Elevation": str(cutout.max_elevation_m),
            "X-Mean-Slope": str(cutout.mean_slope_deg),
        }
        return Response(content=cutout.elevations_m.tobytes(), media_type="application/octet-stream", headers=headers)

    return cutout_json(cutout, site, include_slopes=include_slopes, format_mode=format)
