"""Iluminación media del Sol a largo plazo contra el mapa oficial de NASA PGDA.

Los valores de referencia los genera scripts/fetch_pgda_sun_illumination.py.
PGDA cuenta el Sol como visible si asoma cualquier parte del disco, así que aquí se
usa un margen de menos el radio aparente del Sol. Se promedia un ciclo nodal completo
de la órbita lunar (18,6 años), como el producto.

Diferencias medidas el 15-11-2026 (motor - PGDA, en puntos de fracción): im-1 +0,044,
im-2 0,000, mons-mouton -0,004, mons-malapert +0,023, shackleton-ridge +0,107 y
change-7 +0,079; error medio absoluto 0,043. Quedan documentadas en
docs/modelo/06-validacion.md. Las tolerancias de abajo salen de esas medidas.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

from app.models.horizon import horizon_for

CASES = json.loads((Path(__file__).parent / "data" / "pgda_sun_illumination.json").read_text(encoding="utf-8"))["cases"]
SUN_DISC_RADIUS_DEG = 0.267
START = datetime(2009, 1, 1, tzinfo=timezone.utc)
HOURS = 24 * 365.25 * 18.6
# La iluminación depende mucho del píxel exacto (en shackleton-ridge el mapa va de 0,51 a 0,90 en los
# 3×3 píxeles vecinos): se exige caer en el rango del vecindario con un margen de 2 puntos.
TOLERANCE = 0.02
MEAN_ERROR_LIMIT = 0.06


def motor_fraction(ephemeris, site):
    horizon = horizon_for(site, -SUN_DISC_RADIUS_DEG)
    track = ephemeris.track(site, "sun", START, HOURS, 6.0)
    return float(np.mean(horizon.is_visible(track.azimuth, track.elevation)))


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["site_id"])
def test_iluminacion_media_dentro_del_vecindario_de_pgda(ephemeris, catalog, case):
    site = catalog[case["site_id"]]
    if horizon_for(site, 0.0).kind != "terreno":
        pytest.skip("sin máscara de terreno")
    fraction = motor_fraction(ephemeris, site)
    # El valor del motor debe caer en el rango de los píxeles vecinos (360 m), con la tolerancia.
    assert case["neighborhood_min"] - TOLERANCE <= fraction <= case["neighborhood_max"] + TOLERANCE


def test_iluminacion_media_error_medio_en_los_sitios_polares(ephemeris, catalog):
    errors = []
    for case in CASES:
        site = catalog[case["site_id"]]
        if horizon_for(site, 0.0).kind == "terreno":
            errors.append(abs(motor_fraction(ephemeris, site) - case["visibility"]))
    assert errors, "ningún sitio con máscara de terreno"
    assert float(np.mean(errors)) < MEAN_ERROR_LIMIT
