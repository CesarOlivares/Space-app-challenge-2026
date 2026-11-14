import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pytest

from app.models.site import Site

CASES = json.loads(
    (Path(__file__).parent / "data" / "horizons_cases.json").read_text(encoding="utf-8")
)["cases"]

# RNF-03: diferencia menor a 0,5° respecto de JPL Horizons.
TOLERANCE_DEG = 0.5


def angular_error(az1, el1, az2, el2):
    """Ángulo entre dos direcciones (az, el), en grados."""
    az1, el1, az2, el2 = map(np.radians, (az1, el1, az2, el2))
    cos = np.sin(el1) * np.sin(el2) + np.cos(el1) * np.cos(el2) * np.cos(az1 - az2)
    return np.degrees(np.arccos(np.clip(cos, -1.0, 1.0)))


@pytest.mark.parametrize(
    "case", CASES, ids=lambda c: f"{c['site_id']}-{c['body']}-{c['utc']}"
)
def test_coincide_con_horizons(ephemeris, case):
    site = Site(id=case["site_id"], name=case["site_id"], lat=case["lat"], lon=case["lon"])
    when = datetime.fromisoformat(case["utc"].replace("Z", "+00:00"))
    az, el = ephemeris.position(site, case["body"], when)
    assert abs(el - case["elevation_deg"]) < TOLERANCE_DEG
    assert angular_error(az, el, case["azimuth_deg"], case["elevation_deg"]) < TOLERANCE_DEG


def test_serie_coincide_con_posiciones_sueltas(ephemeris, catalog):
    site = catalog["im-2"]
    start = datetime.fromisoformat("2026-12-01T00:00:00+00:00")
    track = ephemeris.track(site, "sun", start, 72, 24)
    assert list(track.hours) == [0, 24, 48, 72]
    single = ephemeris.position(site, "sun", start.replace(day=3))
    assert track.elevation[2] == pytest.approx(single[1])


def test_fecha_sin_zona_horaria_es_utc(ephemeris, catalog):
    site = catalog["apollo-11"]
    naive = ephemeris.position(site, "earth", datetime(2026, 12, 1))
    aware = ephemeris.position(site, "earth", datetime.fromisoformat("2026-12-01T00:00:00+00:00"))
    assert naive == aware


def test_cuerpo_desconocido(ephemeris, catalog):
    with pytest.raises(ValueError):
        ephemeris.position(catalog["apollo-11"], "mars", datetime(2026, 12, 1))
