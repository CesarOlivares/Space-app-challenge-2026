import json
from pathlib import Path

import numpy as np
import pytest

from app.models.terrain import HorizonMask, PolarDEM, compute_mask

DATA = Path(__file__).resolve().parents[1] / "data"


@pytest.fixture(scope="module")
def dem():
    dem = PolarDEM.open(DATA / "dem")
    if dem is None:
        pytest.skip("falta el DEM: ./run.sh data --dem")
    return dem


@pytest.mark.parametrize("lat, lon, expected_m, tolerance_m", [
    (-80.13, 1.44, 2579, 50),      # IM-1 Odysseus: elevación publicada por NASA
    (-85.98, -1.67, 4900, 300),    # cumbre de Mons Malapert
    (-89.67, 129.78, -2800, 600),  # fondo del cráter Shackleton
])
def test_alturas_conocidas(dem, lat, lon, expected_m, tolerance_m):
    assert float(dem.height(lat, lon)) == pytest.approx(expected_m, abs=tolerance_m)


def test_cobertura():
    assert PolarDEM.covers(-85)
    assert not PolarDEM.covers(-76)  # a menos de 150 km del borde del DEM (75° S)


def test_mascaras_versionadas_coinciden_con_el_dem(dem, catalog):
    for path in sorted((DATA / "horizons").glob("*.json")):
        stored = HorizonMask.load(path)
        fresh = compute_mask(dem, stored.lat, stored.lon)
        np.testing.assert_allclose(fresh.elevation_deg, stored.elevation_deg, atol=0.001, err_msg=path.name)
        assert json.loads(path.read_text())["site_id"] in catalog


def test_cumbre_ve_por_debajo_de_cero(dem):
    # Desde la cumbre de Mons Malapert el horizonte cae bajo 0° en buena parte de las direcciones.
    mask = compute_mask(dem, -85.98, -1.67)
    assert np.mean(mask.elevation_deg < 0) > 0.4
