"""Dependencias compartidas por los controladores: estado de la app y parámetros comunes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, Query, Request

from app.models.ephemeris import Ephemeris, as_utc
from app.models.scoring import ScoringConfig
from app.models.site import Site, custom_site
from app.models.terrain import evaluate_terrain


def get_ephemeris(request: Request) -> Ephemeris:
    return request.app.state.ephemeris


def get_catalog(request: Request) -> dict[str, Site]:
    return request.app.state.catalog


def resolve_site(ref: str, catalog: dict[str, Site]) -> Site:
    """Resolves a site by catalog id or 'lat,lon' coordinates with TerrainMetrics attached."""
    if ref in catalog:
        site = catalog[ref]
        if site.terrain is None:
            return Site(
                **{**site.__dict__, "terrain": evaluate_terrain(site.lat, site.lon)}
            )
        return site
    parts = ref.split(",")
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0]), float(parts[1])
        except ValueError:
            pass
        else:
            return custom_site(lat, lon)  # ValueError if out of range -> 422
    raise HTTPException(
        status_code=404,
        detail=f"sitio desconocido: '{ref}'. Usa un id de /api/sites o coordenadas 'lat,lon'",
    )


def landing_date(
    date: datetime | None = Query(
        None, description="Fecha y hora de aterrizaje en ISO 8601. Sin zona horaria se toma como UTC. "
                          "Por defecto, la hora UTC actual redondeada hacia abajo."
    ),
) -> datetime:
    if date is None:
        return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return as_utc(date)


def _config_dependency(default_step_hours: float):
    """Builds a FastAPI dependency that parses scoring and terrain safety query parameters."""

    def scoring_config(
        window_days: float = Query(14.0, gt=0, le=60, description="Mission window duration in days"),
        step_hours: float = Query(default_step_hours, ge=0.25, le=24, description="Sampling step in hours"),
        sun_margin_deg: float = Query(0.0, ge=-5, le=30, description="Minimum solar elevation margin in degrees"),
        earth_margin_deg: float = Query(0.0, ge=-5, le=30, description="Minimum Earth elevation margin in degrees"),
        weight_energy: float = Query(0.5, ge=0, le=1, description="Weight for energy score"),
        weight_communication: float = Query(0.5, ge=0, le=1, description="Weight for communication score"),
        weight_terrain: float = Query(0.0, ge=0.0, description="Weight for landing ease score"),
        weight_protection: float = Query(0.0, ge=0.0, description="Weight for asteroid & ejecta protection score"),
        max_slope_deg: float = Query(15.0, gt=2.0, le=45.0, description="Maximum allowable landing slope in degrees"),
        panel: Literal["tiempo", "horizontal", "vertical"] = Query(
            "tiempo", description="Solar panel orientation for energy scoring"
        ),
    ) -> ScoringConfig:
        return ScoringConfig(
            window_days=window_days,
            step_hours=step_hours,
            sun_margin_deg=sun_margin_deg,
            earth_margin_deg=earth_margin_deg,
            weight_energy=weight_energy,
            weight_communication=weight_communication,
            weight_terrain=weight_terrain,
            weight_protection=weight_protection,
            max_slope_deg=max_slope_deg,
            panel=panel,
        )

    return scoring_config


# El globo evalúa todo el catálogo: muestreo grueso. El detalle de un sitio: muestreo fino.
coarse_config = _config_dependency(default_step_hours=2.0)
fine_config = _config_dependency(default_step_hours=0.5)
