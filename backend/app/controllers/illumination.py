from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends

from app.controllers.deps import get_ephemeris, landing_date
from app.controllers.serializers import iso
from app.models.ephemeris import Ephemeris

router = APIRouter(prefix="/api", tags=["iluminación"])


@router.get("/illumination")
def illumination(
    date: datetime = Depends(landing_date),
    ephemeris: Ephemeris = Depends(get_ephemeris),
) -> dict:
    """Puntos subsolar y subterrestre: orientan la luz y la vista del globo."""
    sun_lat, sun_lon = ephemeris.subpoint("sun", date)
    earth_lat, earth_lon = ephemeris.subpoint("earth", date)
    return {
        "date": iso(date),
        "subsolar": {"lat": round(sun_lat, 4), "lon": round(sun_lon, 4)},
        "subearth": {"lat": round(earth_lat, 4), "lon": round(earth_lon, 4)},
    }
