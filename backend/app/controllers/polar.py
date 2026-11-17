"""Capas del polo sur (relieve, luz, Tierra, zonas óptimas, calendario) y entorno de un sitio."""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query

from app.controllers.deps import get_catalog, get_ephemeris, landing_date, resolve_site
from app.controllers.serializers import at_offset, iso
from app.models import polar, thermal
from app.models.ephemeris import Ephemeris
from app.models.horizon import horizon_for
from app.models.scoring import EARTH_MARGIN_DEG, STAY_DAYS
from app.models.site import Site
from app.models.terrain import DEM_SOURCE

router = APIRouter(prefix="/api", tags=["polo sur"])

LAYER_STEP_HOURS = 2.0
CALENDAR_STEP_HOURS = 6.0
CALENDAR_STRIDE = 2

# Qué se midió y qué se estimó: la interfaz lo muestra junto a cada capa.
PROVENANCE = {
    "height": {"kind": "measured", "source": DEM_SOURCE, "resolution_m": 120},
    "slope": {"kind": "measured", "source": DEM_SOURCE, "resolution_m": 120},
    "sun": {"kind": "estimated", "source": "Zenith: horizonte del relieve LOLA + efemérides JPL DE440",
            "resolution_m": polar.CELL_M},
    "earth": {"kind": "estimated", "source": "Zenith: horizonte del relieve LOLA + efemérides JPL DE440",
              "resolution_m": polar.CELL_M},
    "optimal": {"kind": "estimated", "source": "Zenith: pendiente medida + luz y Tierra estimadas",
                "resolution_m": polar.CELL_M},
    "temperature": {"kind": "estimated", "source": "Zenith: equilibrio radiativo de primer orden",
                    "resolution_m": polar.CELL_M},
    "shadow": {"kind": "estimated", "source": "Zenith: horizonte del relieve LOLA, Sol en su declinación máxima",
               "resolution_m": polar.CELL_M},
    "availability": {"kind": "estimated", "source": "Zenith: requisitos de superficie fecha por fecha",
                     "resolution_m": polar.CELL_M},
}


def _grid() -> polar.PolarGrid:
    grid = polar.load_grid()
    if grid is None:
        raise HTTPException(status_code=503, detail="Capas del polo sur no disponibles: falta "
                                                    "data/polar/south_pole.npz (./run.sh polar)")
    return grid


def _ints(values: np.ndarray) -> list[int]:
    return np.rint(values).astype(int).ravel().tolist()


def _grid_json(grid: polar.PolarGrid) -> dict:
    return {"n": grid.n, "cell_m": grid.cell_m, "half_extent_km": round(grid.half_extent_km, 1),
            "min_lat": round(float(grid.lat.max()), 2)}


@lru_cache(maxsize=1)
def _relief_json() -> dict:
    grid = _grid()
    return {
        **_grid_json(grid),
        "height_m": _ints(grid.height_m),
        "slope_deg_x10": _ints(grid.slope_deg * 10),
        "flat_pct": _ints(grid.flat_pct),
        "psr": grid.psr.astype(int).ravel().tolist(),
        "flat_slope_deg": polar.FLAT_SLOPE_DEG,
        "psr_pct": round(float(grid.psr.mean()) * 100, 1),
        "provenance": PROVENANCE,
    }


@router.get("/polar/relief")
def polar_relief() -> dict:
    """Relieve del polo sur en grilla estereográfica polar: altura, pendiente y sombra permanente.

    No depende de la fecha: se puede guardar en caché. Los arreglos van por filas; la fila 0 es el
    borde hacia la longitud 0° (la Tierra) y las columnas crecen hacia el este.
    """
    return _relief_json()


@lru_cache(maxsize=48)
def _layers_json(ephemeris: Ephemeris, date: datetime, window_days: float,
                 sun_margin_deg: float, earth_margin_deg: float) -> dict:
    grid = _grid()
    hours = window_days * 24.0
    sun = polar.visibility(grid, ephemeris, "sun", date, hours, LAYER_STEP_HOURS, sun_margin_deg)
    earth = polar.visibility(grid, ephemeris, "earth", date, hours, LAYER_STEP_HOURS, earth_margin_deg)
    # Se redondea antes de clasificar: la zona óptima se decide con los mismos números que se muestran.
    sun_pct = np.rint(sun.clear.mean(axis=1) * 100)
    earth_pct = np.rint(earth.clear.mean(axis=1) * 100)
    optimal = polar.optimal_mask(grid, sun_pct, earth_pct)
    # Temperatura máxima: equilibrio con el Sol en su punto más alto de la ventana; sin Sol, el piso.
    lit = sun.max_elevation_deg > -90
    peak_k = np.where(lit, thermal.equilibrium_temperature(sun.max_elevation_deg), thermal.FLOOR_TEMPERATURE_K)
    return {
        **_grid_json(grid),
        "date": iso(date),
        "window_days": window_days,
        "step_hours": LAYER_STEP_HOURS,
        "sun_pct": _ints(sun_pct),
        "earth_pct": _ints(earth_pct),
        "temp_max_k": _ints(peak_k),
        "optimal": optimal.astype(int).tolist(),
        "thresholds": {"flat_pct": polar.OPTIMAL_MIN_FLAT_PCT, "sun_pct": polar.OPTIMAL_MIN_SUN_PCT,
                       "earth_pct": polar.OPTIMAL_MIN_EARTH_PCT, "flat_slope_deg": polar.FLAT_SLOPE_DEG,
                       "ice_stability_k": thermal.ICE_STABILITY_K},
        "stats": {
            "optimal_pct": round(float(optimal.mean()) * 100, 2),
            "flat_pct": round(float((grid.flat_pct.ravel() >= polar.OPTIMAL_MIN_FLAT_PCT).mean()) * 100, 1),
            "sun_pct": round(float((sun_pct >= polar.OPTIMAL_MIN_SUN_PCT).mean()) * 100, 1),
            "earth_pct": round(float((earth_pct >= polar.OPTIMAL_MIN_EARTH_PCT).mean()) * 100, 1),
        },
        "provenance": PROVENANCE,
    }


@router.get("/polar/layers")
def polar_layers(
    date: datetime = Depends(landing_date),
    window_days: float = Query(14.0, gt=0, le=30, description="Ventana que se promedia, en días"),
    sun_margin_deg: float = Query(0.0, ge=-5, le=30),
    earth_margin_deg: float = Query(EARTH_MARGIN_DEG, ge=-5, le=30),
    ephemeris: Ephemeris = Depends(get_ephemeris),
) -> dict:
    """Luz, visibilidad de la Tierra, temperatura máxima y zonas óptimas del polo sur para una fecha.

    Para cada celda se compara el horizonte del relieve con la posición real del Sol y de la Tierra
    durante la ventana (declinación solar y libración de esa fecha). Es una estimación de Zenith.
    """
    return _layers_json(ephemeris, date, window_days, sun_margin_deg, earth_margin_deg)


@lru_cache(maxsize=8)
def _availability_json(ephemeris: Ephemeris, date: datetime, days: float, stay_days: float,
                       sun_margin_deg: float, earth_margin_deg: float) -> dict:
    grid = _grid().coarse(CALENDAR_STRIDE)  # un año de fechas: una de cada dos celdas (4,8 km)
    step = CALENDAR_STEP_HOURS
    hours = (days + stay_days) * 24.0
    sun = polar.visibility(grid, ephemeris, "sun", date, hours, step, sun_margin_deg)
    earth = polar.visibility(grid, ephemeris, "earth", date, hours, step, earth_margin_deg)
    stay_samples = int(np.ceil(stay_days * 24.0 / step))
    per_day = int(round(24.0 / step))
    landings = np.arange(0, int(days) * per_day + 1, per_day)  # una fecha de aterrizaje por día

    # Los mismos requisitos duros que un sitio: Sol al aterrizar y durante toda la estancia,
    # Tierra a la vista al aterrizar y terreno apto.
    sun_ok = polar.continuous_from_start(sun.clear)[:, landings] >= stay_samples
    earth_ok = earth.clear[:, landings]
    flat_ok = grid.flat_pct.ravel() >= polar.OPTIMAL_MIN_FLAT_PCT
    ok = sun_ok & earth_ok & flat_ok[:, None]
    return {
        **_grid_json(grid),
        "start": iso(date),
        "days": days,
        "stay_days": stay_days,
        "step_hours": step,
        "evaluated": int(landings.size),
        "available_pct": _ints(ok.mean(axis=1) * 100),
        "ever_available_pct": round(float(ok.any(axis=1).mean()) * 100, 1),
        "dates": [{
            "date": at_offset(date, float(t * step)),
            "area_pct": round(float(ok[:, i].mean()) * 100, 2),
            "sun_pct": round(float((sun_ok[:, i] & flat_ok).mean()) * 100, 2),
            "earth_pct": round(float((earth_ok[:, i] & flat_ok).mean()) * 100, 2),
        } for i, t in enumerate(landings)],
        "provenance": PROVENANCE,
    }


@router.get("/polar/availability")
def polar_availability(
    date: datetime = Depends(landing_date),
    days: float = Query(365.0, ge=1, le=400, description="Cuántos días recorrer desde `date`"),
    stay_days: float = Query(STAY_DAYS, gt=0, le=30, description="Estancia que la luz continua debe cubrir"),
    sun_margin_deg: float = Query(0.0, ge=-5, le=30),
    earth_margin_deg: float = Query(EARTH_MARGIN_DEG, ge=-5, le=30),
    ephemeris: Ephemeris = Depends(get_ephemeris),
) -> dict:
    """Calendario regional: en cuántas fechas de aterrizaje cada celda cumple todos los requisitos.

    Es la disponibilidad de superficie que usa la NASA para comparar regiones, por celda
    (`available_pct`) y por fecha (`dates[].area_pct`, el % del área que cumple ese día).
    """
    # Se redondea al día: el calendario no cambia de una hora a otra y así la caché rinde.
    start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    return _availability_json(ephemeris, start, float(int(days)), stay_days, sun_margin_deg, earth_margin_deg)


@router.get("/sites/{site_ref}/environment")
def site_environment(
    site_ref: str,
    date: datetime = Depends(landing_date),
    days: float = Query(14.0, gt=0, le=60, description="Duración de la serie"),
    step_hours: float = Query(1.0, ge=0.25, le=24),
    sun_margin_deg: float = Query(0.0, ge=-5, le=30),
    ephemeris: Ephemeris = Depends(get_ephemeris),
    catalog: dict[str, Site] = Depends(get_catalog),
) -> dict:
    """Entorno del sitio: temperatura estimada durante la estancia y cercanía a sombra permanente."""
    site = resolve_site(site_ref, catalog)
    track = ephemeris.track(site, "sun", date, days * 24.0, step_hours)
    horizon = horizon_for(site, sun_margin_deg)
    visible = horizon.is_visible(track.azimuth, track.elevation)
    kelvin = thermal.temperature_series(track.hours, track.elevation, visible)

    shadow = None
    grid = polar.load_grid()
    cell = grid.cell_of(site.lat, site.lon) if grid is not None else None
    if cell is not None:
        shadow = {
            "in_permanent_shadow": bool(grid.psr[cell]),
            "distance_km": round(float(grid.psr_distance_km[cell]), 1),
            "cell_flat_pct": round(float(grid.flat_pct[cell]), 0),
            "resolution_m": polar.CELL_M,
        }
    return {
        "site_id": site.id,
        "start": iso(track.start),
        "step_hours": step_hours,
        "horizon": horizon.kind,
        "temperature": {
            "kelvin": [round(float(v), 1) for v in kelvin],
            "min_k": round(float(kelvin.min()), 1),
            "max_k": round(float(kelvin.max()), 1),
            "mean_k": round(float(kelvin.mean()), 1),
            "hours_below_ice_stability": round(float((kelvin < thermal.ICE_STABILITY_K).sum() * step_hours), 1),
            "ice_stability_k": thermal.ICE_STABILITY_K,
            "model": "Balance radiativo de una capa (A=0,12; ε=0,95); superficie horizontal",
        },
        "shadow": shadow,
        "provenance": {"temperature": PROVENANCE["temperature"], "shadow": PROVENANCE["shadow"]},
    }
