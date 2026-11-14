"""Dependencias compartidas por los controladores: estado de la app y parámetros comunes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Query, Request

from app.models.ephemeris import Ephemeris, as_utc
from app.models.scoring import ScoringConfig
from app.models.site import Site, custom_site


def get_ephemeris(request: Request) -> Ephemeris:
    return request.app.state.ephemeris


def get_catalog(request: Request) -> dict[str, Site]:
    return request.app.state.catalog


def resolve_site(ref: str, catalog: dict[str, Site]) -> Site:
    """Un sitio se indica por su id del catálogo o como "lat,lon" en grados."""
    if ref in catalog:
        return catalog[ref]
    parts = ref.split(",")
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0]), float(parts[1])
        except ValueError:
            pass
        else:
            return custom_site(lat, lon)  # ValueError si está fuera de rango → 422
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
    def scoring_config(
        window_days: float = Query(14.0, gt=0, le=60, description="Duración de la ventana de misión"),
        step_hours: float = Query(default_step_hours, ge=0.25, le=24, description="Paso de muestreo"),
        sun_margin_deg: float = Query(0.0, ge=-5, le=30, description="Elevación mínima del Sol"),
        earth_margin_deg: float = Query(0.0, ge=-5, le=30, description="Elevación mínima de la Tierra"),
        weight_energy: float = Query(0.5, ge=0, le=1),
        weight_communication: float = Query(0.5, ge=0, le=1),
    ) -> ScoringConfig:
        return ScoringConfig(
            window_days=window_days,
            step_hours=step_hours,
            sun_margin_deg=sun_margin_deg,
            earth_margin_deg=earth_margin_deg,
            weight_energy=weight_energy,
            weight_communication=weight_communication,
        )

    return scoring_config


# El globo evalúa todo el catálogo: muestreo grueso. El detalle de un sitio: muestreo fino.
coarse_config = _config_dependency(default_step_hours=2.0)
fine_config = _config_dependency(default_step_hours=0.5)
