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


@pytest.mark.parametrize("body", ["sun", "earth"])
def test_subpunto_tiene_al_cuerpo_en_el_cenit(ephemeris, body):
    when = datetime.fromisoformat("2026-12-15T00:00:00+00:00")
    lat, lon = ephemeris.subpoint(body, when)
    _, elevation = ephemeris.position(Site(id="sub", name="sub", lat=lat, lon=lon), body, when)
    assert elevation > 89.9


def test_subpunto_terrestre_cerca_del_centro_de_la_cara_visible(ephemeris):
    # La libración mueve el punto subterrestre a lo sumo ~8° del origen.
    lat, lon = ephemeris.subpoint("earth", datetime(2026, 12, 15))
    assert abs(lat) < 8 and abs(lon) < 9


@pytest.mark.parametrize("utc, separation", [
    ("2026-11-09T07:03:00+00:00", 180),  # luna nueva
    ("2026-11-17T11:48:00+00:00", 90),   # cuarto creciente
    ("2026-11-24T14:53:00+00:00", 0),    # luna llena
    ("2026-12-01T06:08:00+00:00", 90),   # cuarto menguante
])
def test_terminador_coincide_con_las_fases_lunares(ephemeris, utc, separation):
    """Diferencia de longitud entre el punto subsolar y el subterrestre en fechas de fases publicadas."""
    when = datetime.fromisoformat(utc)
    _, sun_lon = ephemeris.subpoint("sun", when)
    _, earth_lon = ephemeris.subpoint("earth", when)
    difference = abs((sun_lon - earth_lon + 180) % 360 - 180)
    assert difference == pytest.approx(separation, abs=1)


def test_cuerpo_desconocido(ephemeris, catalog):
    with pytest.raises(ValueError):
        ephemeris.position(catalog["apollo-11"], "mars", datetime(2026, 12, 1))
