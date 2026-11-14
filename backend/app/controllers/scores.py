from datetime import datetime, timedelta

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
from app.models.scoring import ScoringConfig, evaluate, evaluate_all
from app.models.site import Site

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
    start: datetime = Depends(landing_date),
    days: float = Query(30.0, gt=0, le=90, description="Rango de evaluación en días"),
    step_hours: float = Query(12.0, ge=1.0, le=48.0, description="Separación en horas entre fechas evaluadas"),
    sites: str | None = Query(None, description="IDs o coordenadas separados por coma. Si se omite, evalúa todo el catálogo"),
    config: ScoringConfig = Depends(coarse_config),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Matriz temporal de viabilidad y puntajes para múltiples sitios a lo largo de un rango de fechas (V6)."""
    if sites:
        target_sites = tuple(resolve_site(ref.strip(), catalog) for ref in sites.split(",") if ref.strip())
    else:
        target_sites = tuple(catalog.values())

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
