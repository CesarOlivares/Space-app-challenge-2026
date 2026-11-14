"""Visibilidad de la Tierra a largo plazo contra el mapa oficial de NASA PGDA.

Los valores de referencia los genera scripts/fetch_pgda_earth_visibility.py.
PGDA cuenta la Tierra como visible si asoma cualquier parte del disco, así que
aquí se usa un margen de menos el radio aparente del disco. Se promedia un
ciclo nodal completo de la órbita lunar (18,6 años) para cubrir la libración.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

from app.models.horizon import horizon_for

CASES = json.loads((Path(__file__).parent / "data" / "pgda_earth_visibility.json").read_text(encoding="utf-8"))["cases"]
EARTH_DISC_RADIUS_DEG = 0.95
START = datetime(2009, 1, 1, tzinfo=timezone.utc)
HOURS = 24 * 365.25 * 18.6


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["site_id"])
def test_visibilidad_de_la_tierra_coincide_con_pgda(ephemeris, catalog, case):
    site = catalog[case["site_id"]]
    horizon = horizon_for(site, -EARTH_DISC_RADIUS_DEG)
    if horizon.kind != "terreno":
        pytest.skip("sin máscara de terreno")
    track = ephemeris.track(site, "earth", START, HOURS, 6.0)
    fraction = float(np.mean(horizon.is_visible(track.azimuth, track.elevation)))
    assert fraction == pytest.approx(case["visibility"], abs=0.03)
