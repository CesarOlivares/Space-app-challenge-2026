from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.controllers.scores import _build_risk_grid
from app.main import app
from app.models.scoring import ScoringConfig, evaluate
from app.models.terrain import PolarDEM, evaluate_terrain, evaluate_terrain_patch

DATA = Path(__file__).resolve().parents[1] / "data"
LANDING = datetime.fromisoformat("2026-12-15T00:00:00+00:00")


@pytest.fixture(scope="module")
def dem():
    dem = PolarDEM.open(DATA / "dem")
    if dem is None:
        pytest.skip("falta el DEM: ./run.sh data --dem")
    return dem


def test_sitios_polares_usan_el_dem(dem, catalog):
    polares = [s for s in catalog.values() if s.lat <= -80]
    assert len(polares) == 6
    for site in polares:
        assert site.terrain.source == "lola_dem", site.id
        assert site.terrain.slope_deg is not None


def test_mons_mouton_toma_la_pendiente_del_dem(dem, catalog):
    # El catálogo decía 3,8°; el plano sobre 3×3 píxeles del DEM da ~9,4°.
    assert catalog["mons-mouton"].terrain.slope_deg == pytest.approx(9.4, abs=0.3)


def test_fuera_del_dem_no_hay_pendiente_ni_rugosidad(catalog):
    terrain = catalog["apollo-11"].terrain
    assert terrain.source == "unavailable"
    assert terrain.slope_deg is None
    assert terrain.roughness_m is None
    assert terrain.elevation_m == -1926


def test_coordenada_sin_catalogo_fuera_del_dem():
    terrain = evaluate_terrain(10.0, 20.0)
    assert terrain.source == "unavailable"
    assert terrain.elevation_m is None


def test_sin_dato_no_cambia_el_puntaje_ni_la_viabilidad(ephemeris, catalog):
    site = catalog["apollo-11"]
    base = evaluate(ephemeris, site, LANDING)
    con_peso = evaluate(ephemeris, site, LANDING, ScoringConfig(weight_terrain=1.0, max_slope_deg=3.0))
    assert base.terrain_score is None
    assert base.slope_ok is None
    assert base.asteroid_protection_score is None
    assert base.total == pytest.approx((base.energy + base.communication) / 2)
    assert con_peso.total == pytest.approx(base.total)
    assert base.viable == (base.sun.visible and base.earth.visible)
    assert con_peso.viable == base.viable


def test_terreno_y_proteccion_no_pesan_por_defecto(dem, ephemeris, catalog):
    result = evaluate(ephemeris, catalog["im-2"], LANDING)
    assert result.terrain_score is not None
    assert result.asteroid_protection_score is not None
    assert result.total == pytest.approx((result.energy + result.communication) / 2)


def test_api_entrega_nulos_sin_dato(ephemeris):
    with TestClient(app) as client:
        scores = client.get("/api/scores", params={"date": "2026-12-15T00:00:00Z"}).json()["scores"]
    apollo = next(s for s in scores if s["site_id"] == "apollo-11")
    assert apollo["scores"]["terrain"] is None
    assert apollo["scores"]["asteroid"] is None
    assert apollo["topography"]["slope_deg"] is None
    assert apollo["topography"]["source"] == "unavailable"
    assert "slope_ok" not in apollo["topography"]


def test_parche_fuera_del_dem_esta_vacio():
    patch = evaluate_terrain_patch(0.67, 23.47, size=25)
    assert patch["source"] == "unavailable"
    assert patch["elevation_m"] == []


def test_grilla_de_riesgo_sin_valores_inventados():
    _build_risk_grid.cache_clear()
    cells = _build_risk_grid(15.0)["cells"]
    assert all(c["asteroid_protection"] is None for c in cells)
    assert all(c["slope_deg"] is None for c in cells if c["lat"] > -75)
