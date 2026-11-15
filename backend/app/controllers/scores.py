from datetime import datetime, timedelta
from functools import lru_cache
import math

from fastapi import APIRouter, Depends, Query
import numpy as np
from pydantic import BaseModel, Field

from app.controllers.deps import (
    coarse_config,
    fine_config,
    get_catalog,
    get_ephemeris,
    landing_date,
    resolve_site,
)
from app.controllers.serializers import config_json, evaluation_json, iso
from app.models.ephemeris import Ephemeris, as_utc
from app.models.scoring import (
    ScoringConfig,
    compute_landing_ease_score,
    evaluate,
    evaluate_all,
)
from app.models.site import Site, custom_site
from app.models.terrain import evaluate_terrain

router = APIRouter(prefix="/api", tags=["puntajes"])


@router.get("/scores")
def scores(
    date: datetime = Depends(landing_date),
    config: ScoringConfig = Depends(coarse_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Evaluates all catalog sites for a landing date, returning Energy, Communication, Terrain scores and topography."""
    results = evaluate_all(ephemeris, tuple(catalog.values()), date, config)
    return {
        "date": iso(date),
        "config": config_json(config),
        "scores": [evaluation_json(r, detailed=False) for r in results],
    }


class CustomPoint(BaseModel):
    """Arbitrary lunar surface coordinates placed by the user."""

    lat: float = Field(ge=-90.0, le=90.0, description="Planetocentric latitude in degrees [-90, 90]")
    lon: float = Field(ge=-180.0, le=180.0, description="East longitude in degrees [-180, 180]")
    name: str | None = Field(default=None, max_length=60, description="Optional custom label")


class CustomScoresRequest(BaseModel):
    """Batch evaluation payload for user-placed arbitrary lunar points."""

    points: list[CustomPoint] = Field(min_length=1, max_length=50)


@router.post("/scores/custom")
def custom_scores(
    request: CustomScoresRequest,
    date: datetime = Depends(landing_date),
    config: ScoringConfig = Depends(coarse_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
) -> dict:
    """Evaluates user-placed arbitrary (lat, lon) points under the active general weighted ponderator."""
    sites = tuple(custom_site(p.lat, p.lon) for p in request.points)
    results = evaluate_all(ephemeris, sites, date, config)
    return {
        "date": iso(date),
        "config": config_json(config),
        "scores": [evaluation_json(r, detailed=False) for r in results],
    }


class Scenario(BaseModel):
    site: str = Field(description="Id del catálogo o coordenadas 'lat,lon'", examples=["im-2"])
    date: datetime = Field(description="Fecha de aterrizaje ISO 8601", examples=["2026-12-15T00:00:00Z"])


class CompareRequest(BaseModel):
    scenarios: list[Scenario] = Field(min_length=2, max_length=4)


@router.post("/compare")
def compare(
    request: CompareRequest,
    config: ScoringConfig = Depends(fine_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Returns full illumination, communication, and topography metrics for 2 to 4 site-date scenarios."""
    results = [
        evaluate(ephemeris, resolve_site(s.site, catalog), as_utc(s.date), config)
        for s in request.scenarios
    ]
    return {
        "config": config_json(config),
        "results": [evaluation_json(r, detailed=True) for r in results],
    }


@router.get("/scores/matrix")
def scores_matrix(
    start: datetime | None = Query(None, description="Fecha de inicio en ISO 8601 UTC (también se acepta `date`)"),
    date: datetime | None = Query(None, description="Alias de `start`"),
    days: float = Query(30.0, gt=0, le=90, description="Rango de evaluación en días"),
    step_hours: float = Query(12.0, ge=1.0, le=48.0, description="Separación en horas entre fechas evaluadas"),
    sites: str | None = Query(None, description="IDs o coordenadas `lat,lon` separados por `|`. Si se omite, evalúa todo el catálogo"),
    config: ScoringConfig = Depends(coarse_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Matriz temporal de viabilidad y puntajes para múltiples sitios a lo largo de un rango de fechas (V6)."""
    if sites:
        target_sites = tuple(resolve_site(ref.strip(), catalog) for ref in sites.split("|") if ref.strip())
    else:
        target_sites = tuple(catalog.values())

    start = landing_date(start if start is not None else date)
    count = int(np.floor(days * 24 / step_hours + 1e-9)) + 1
    if count > 500:
        raise ValueError(f"demasiadas fechas ({count}); máximo 500. Aumenta 'step_hours' o reduce 'days'.")

    dates = [start + timedelta(hours=i * step_hours) for i in range(count)]
    sites_data = [
        {
            "id": s.id,
            "name": s.name,
            "lat": s.lat,
            "lon": s.lon,
            "category": s.category,
            "series": [],
        }
        for s in target_sites
    ]

    for d in dates:
        results = evaluate_all(ephemeris, target_sites, d, config)
        for i, r in enumerate(results):
            sites_data[i]["series"].append({
                "viable": r.viable,
                "total": round(r.total, 1),
                "energy": round(r.energy, 1),
                "communication": round(r.communication, 1),
                "sun_elevation_deg": round(r.sun.elevation_deg, 2),
                "earth_elevation_deg": round(r.earth.elevation_deg, 2),
            })

    return {
        "start": iso(start),
        "days": days,
        "step_hours": step_hours,
        "config": config_json(config),
        "dates": [iso(d) for d in dates],
        "sites": sites_data,
    }


@lru_cache(maxsize=1)
def _build_risk_grid(max_slope_deg: float = 15.0) -> dict:
    """Builds and caches a 72x36 global grid for the on-globe heatmap overlays.

    Slope and Landing Ease are measured: cells without polar DEM coverage carry None.
    Solar exposure and Earth line-of-sight are coarse geometric estimates (latitude,
    sub-Earth point), refined with measured relief where the DEM exists. There is no
    asteroid protection layer: it needs a terrain horizon per cell, which a 5° grid cannot give.
    """
    cols, rows = 72, 36
    lon_step = 360.0 / cols
    lat_step = 180.0 / rows
    cells = []
    for r in range(rows):
        lat = -90.0 + (r + 0.5) * lat_step
        lat_rad = math.radians(lat)
        lat_abs = abs(lat)
        for c in range(cols):
            lon = -180.0 + (c + 0.5) * lon_step
            lon_rad = math.radians(lon)
            metrics = evaluate_terrain(lat, lon)
            landing_ease = compute_landing_ease_score(metrics, max_slope_deg=max_slope_deg)
            measured = metrics.available

            # Solar exposure estimation (% illumination over synodic cycle):
            # Mid/equatorial latitudes: ~50% day/night cycle.
            # Polar latitudes (|lat| > 65°): grazing sun depends on elevation and equator-facing
            # slope aspect; that refinement only applies where the DEM gives measured relief.
            if lat_abs <= 65.0:
                solar_exp = 50.0 + 3.0 * math.cos(lat_rad)
            elif not measured:
                solar_exp = 50.0
            else:
                polar_frac = (lat_abs - 65.0) / 25.0
                elev_km = metrics.elevation_m / 1000.0
                solar_base = 45.0 + 18.0 * float(np.clip(elev_km / 2.0, -1.0, 1.0))
                aspect_rad = math.radians(metrics.aspect_deg)
                slope_rad = math.radians(metrics.slope_deg)
                # Slopes facing toward the equator receive more grazing sun
                slope_facing = math.sin(slope_rad) * math.cos(aspect_rad if lat < 0 else aspect_rad - math.pi)
                polar_solar = float(np.clip(solar_base + 15.0 * slope_facing, 5.0, 95.0))
                solar_exp = (1.0 - polar_frac) * 50.0 + polar_frac * polar_solar

            # Earth Direct-to-Earth Communication Line-of-Sight estimation:
            # Tidal locking: Sub-Earth point is near (0°, 0°).
            cos_delta = math.cos(lat_rad) * math.cos(lon_rad)
            delta_deg = math.degrees(math.acos(float(np.clip(cos_delta, -1.0, 1.0))))
            earth_el_deg = 90.0 - delta_deg
            if earth_el_deg > 5.0:
                earth_comm = 100.0
            elif earth_el_deg < -5.0:
                earth_comm = 0.0
            else:
                # Libration transition limb (-5° to +5°)
                earth_comm = float(np.clip((earth_el_deg + 5.0) * 10.0, 0.0, 100.0))

            # Deep polar basins with low Earth elevation have terrain blockage
            if measured and lat_abs > 75.0 and earth_el_deg < 10.0 and metrics.elevation_m < -600:
                earth_comm = max(0.0, earth_comm - 35.0)

            # Combined Suitability (3-variable intersection: Landing Ease + Solar Access + Earth Comm).
            # Hard exclusion (NO-GO): A cell is non-viable if any of the 3 criteria fails:
            # 1. No direct line-of-sight to Earth (earth_comm < 15.0 / Far Side without relay).
            # 2. Extreme permanent shadow cold trap (solar_exp < 20.0).
            # 3. Measured slope exceeds critical tip-over angle (slope_deg > max_slope_deg).
            is_viable = (earth_comm >= 15.0) and (solar_exp >= 20.0)
            if metrics.slope_deg is not None and metrics.slope_deg > max_slope_deg:
                is_viable = False

            if not is_viable:
                suitability = 0.0
            else:
                solar_term = float(np.clip((solar_exp - 20.0) * (100.0 / 60.0), 0.0, 100.0))
                comm_term = float(np.clip((earth_comm - 15.0) * (100.0 / 85.0), 0.0, 100.0))
                if landing_ease is None:
                    # Without measured local slope, use 75.0 baseline (smooth mare average)
                    suitability = 0.40 * 75.0 + 0.35 * solar_term + 0.25 * comm_term
                else:
                    suitability = 0.40 * landing_ease + 0.35 * solar_term + 0.25 * comm_term

            cells.append({
                "lat": round(lat, 2),
                "lon": round(lon, 2),
                "elevation_m": None if metrics.elevation_m is None else round(metrics.elevation_m, 1),
                "slope_deg": None if metrics.slope_deg is None else round(metrics.slope_deg, 2),
                "landing_ease": None if landing_ease is None else round(landing_ease, 1),
                "asteroid_protection": None,
                "solar_exposure": round(float(np.clip(solar_exp, 0.0, 100.0)), 1),
                "earth_comm": round(float(np.clip(earth_comm, 0.0, 100.0)), 1),
                "suitability": round(float(np.clip(suitability, 0.0, 100.0)), 1),
            })
    return {
        "cols": cols,
        "rows": rows,
        "lon_step_deg": lon_step,
        "lat_step_deg": lat_step,
        "cells": cells,
    }


@router.get("/risk-grid")
def risk_grid(
    max_slope_deg: float = Query(15.0, gt=2.0, le=45.0, description="Max safe slope threshold in degrees"),
) -> dict:
    """Returns a cached 72x36 grid: measured slope and Landing Ease (null outside the polar DEM) plus
    coarse geometric estimates of solar exposure, Earth signal and suitability."""
    return _build_risk_grid(round(float(max_slope_deg), 1))
