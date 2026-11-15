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


def test_cutout_polar_site(dem):
    # IM-2 en cresta conectora de Shackleton
    cutout = dem.cutout(-89.444, 137.444, size_px=64, step=1)
    assert cutout.width == 64
    assert cutout.height == 64
    assert cutout.step_m == 120.0
    assert cutout.extent_km == pytest.approx(7.68)
    assert cutout.elevations_m.shape == (64, 64)
    assert cutout.slopes_deg.shape == (64, 64)
    assert -3000 < cutout.center_elevation_m < 3000
    assert cutout.min_elevation_m <= cutout.max_elevation_m
    assert 0 <= cutout.mean_slope_deg < 90
    assert 0 <= cutout.safe_landing_fraction <= 1.0


def test_cutout_fuera_de_rango(dem):
    with pytest.raises(ValueError, match="no cubre"):
        dem.cutout(0.0, 0.0, size_px=64)


def test_terrain_patch_solar_mapping(dem, ephemeris):
    from datetime import datetime
    from app.models.terrain import evaluate_terrain_patch

    date = datetime.fromisoformat("2026-12-15T00:00:00+00:00")
    patch = evaluate_terrain_patch(
        -84.7906, 29.1957, size=25, ephemeris=ephemeris, date=date, window_days=14.0
    )
    assert patch["size"] == 25
    assert patch["source"] == "lola_dem"
    assert "solar" in patch
    solar = patch["solar"]
    assert len(solar["exposure_pct"]) == 25
    assert len(solar["exposure_pct"][0]) == 25
    assert len(solar["instant_lit"]) == 25
    assert 0.0 <= solar["mean_solar_pct"] <= 100.0
    assert 0.0 <= solar["optimal_landing_pct"] <= 100.0
    assert solar["sun_elevation_deg"] > 0
    # Verifica que la iluminación varía espacialmente según el relieve local
    flat_solar = [v for row in solar["exposure_pct"] for v in row]
    assert min(flat_solar) < max(flat_solar)


def test_global_dem_features():
    from app.models.terrain import _get_global_dem, evaluate_terrain

    gdem = _get_global_dem()
    if gdem is None:
        pytest.skip("DEM global LOLA no presente (ejecutar ./run.sh data)")

    # Apollo 11 en Mare Tranquillitatis: mare plano, pendiente muy suave (< 2°)
    ap11 = evaluate_terrain(0.674, 23.473)
    assert ap11.source == "lola_global"
    assert -2100 <= ap11.elevation_m <= -1800
    assert ap11.slope_deg < 2.0
    assert ap11.aspect_deg is not None

    # Borde del Cráter Tycho (-43.3° S, -11.2° O): pared empinada (> 10°)
    tycho = evaluate_terrain(-43.3, -11.2)
    assert tycho.source == "lola_global"
    assert tycho.slope_deg > 10.0


def test_global_dem_patch_solar_mapping(ephemeris):
    from datetime import datetime
    from app.models.terrain import _get_global_dem, evaluate_terrain_patch

    if _get_global_dem() is None:
        pytest.skip("DEM global LOLA no presente")

    date = datetime.fromisoformat("2026-12-15T00:00:00+00:00")
    # Tycho crater patch
    patch = evaluate_terrain_patch(-43.3, -11.2, size=25, ephemeris=ephemeris, date=date, window_days=14.0)
    assert patch["size"] == 25
    assert patch["source"] == "lola_global"
    assert "solar" in patch
    solar = patch["solar"]
    assert len(solar["exposure_pct"]) == 25
    assert 0.0 <= solar["mean_solar_pct"] <= 100.0
    assert len(patch["slope_deg"]) == 25
    # En Tycho, las pendientes máximas superan los 15°
    flat_slopes = [s for row in patch["slope_deg"] for s in row]
    assert max(flat_slopes) > 15.0
