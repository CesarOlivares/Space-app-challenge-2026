from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
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
    """Puntajes de todos los sitios del catálogo para una fecha (alimenta el globo)."""
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
    """Métricas completas de 2 a 4 escenarios sitio-fecha, en el orden recibido."""
    results = [
        evaluate(ephemeris, resolve_site(s.site, catalog), as_utc(s.date), config)
        for s in request.scenarios
    ]
    return {
        "config": config_json(config),
        "results": [evaluation_json(r, detailed=True) for r in results],
    }
