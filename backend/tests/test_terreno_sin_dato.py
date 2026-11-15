from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.controllers.scores import _build_risk_grid
from app.main import app
from app.models.scoring import ScoringConfig, evaluate
from app.models.terrain import (
    PolarDEM,
    _evaluate_from_coordinates,
    _get_global_dem,
    evaluate_terrain,
    evaluate_terrain_patch,
)

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
    if _get_global_dem() is None:
        assert terrain.source == "unavailable"
        assert terrain.slope_deg is None
        assert terrain.roughness_m is None
        assert terrain.elevation_m == -1926
    else:
        assert terrain.source == "lola_global"
        assert terrain.slope_deg == pytest.approx(0.78, abs=0.3)
        assert terrain.roughness_m is not None
        assert terrain.elevation_m == pytest.approx(-1920, abs=25)


def test_coordenada_sin_catalogo_fuera_del_dem():
    terrain = evaluate_terrain(10.0, 20.0)
    if _get_global_dem() is None:
        assert terrain.source == "unavailable"
        assert terrain.elevation_m is None
    else:
        assert terrain.source == "lola_global"
        assert terrain.elevation_m is not None
        assert terrain.slope_deg is not None


def test_sin_dato_no_cambia_el_puntaje_ni_la_viabilidad(ephemeris, catalog):
    site = catalog["apollo-11"]
    base = evaluate(ephemeris, site, LANDING)
    con_peso = evaluate(ephemeris, site, LANDING, ScoringConfig(weight_terrain=1.0, max_slope_deg=3.0))
    if _get_global_dem() is None:
        assert base.terrain_score is None
        assert base.slope_ok is None
        assert base.asteroid_protection_score is None
        assert base.total == pytest.approx((base.energy + base.communication) / 2)
        assert con_peso.total == pytest.approx(base.total)
        assert base.viable == (base.sun.visible and base.earth.visible)
        assert con_peso.viable == base.viable
    else:
        assert base.terrain_score is not None
        assert base.slope_ok is True
        assert base.asteroid_protection_score is None
        assert base.viable is True


def test_terreno_y_proteccion_no_pesan_por_defecto(dem, ephemeris, catalog):
    result = evaluate(ephemeris, catalog["im-2"], LANDING)
    assert result.terrain_score is not None
    assert result.asteroid_protection_score is not None
    assert result.total == pytest.approx((result.energy + result.communication) / 2)


def test_api_entrega_nulos_sin_dato(ephemeris):
    with TestClient(app) as client:
        scores = client.get("/api/scores", params={"date": "2026-12-15T00:00:00Z"}).json()["scores"]
    apollo = next(s for s in scores if s["site_id"] == "apollo-11")
    if _get_global_dem() is None:
        assert apollo["scores"]["terrain"] is None
        assert apollo["scores"]["asteroid"] is None
        assert apollo["topography"]["slope_deg"] is None
        assert apollo["topography"]["source"] == "unavailable"
        assert "slope_ok" not in apollo["topography"]
    else:
        assert apollo["scores"]["terrain"] is not None
        assert apollo["scores"]["asteroid"] is None
        assert apollo["topography"]["slope_deg"] is not None
        assert apollo["topography"]["source"] == "lola_global"


def test_parche_fuera_del_dem_esta_vacio():
    patch = evaluate_terrain_patch(0.67, 23.47, size=25)
    if _get_global_dem() is None:
        assert patch["source"] == "unavailable"
        assert patch["elevation_m"] == []
    else:
        assert patch["source"] == "lola_global"
        assert len(patch["elevation_m"]) == 25
        assert len(patch["slope_deg"]) == 25


def test_grilla_de_riesgo_sin_valores_inventados():
    _build_risk_grid.cache_clear()
    cells = _build_risk_grid(15.0)["cells"]
    assert all(c["asteroid_protection"] is None for c in cells)
    if _get_global_dem() is None:
        assert all(c["slope_deg"] is None for c in cells if c["lat"] > -75)
    else:
        assert all(c["slope_deg"] is not None for c in cells)
        assert any(c["slope_deg"] > 15.0 for c in cells)


def test_degradacion_sin_datos_cuando_falta_dem_global(monkeypatch):
    """Verifica que sin DEM global, la aplicación degrade limpiamente a 'unavailable' sin inventar números."""
    monkeypatch.setattr("app.models.terrain._get_global_dem", lambda: None)
    _evaluate_from_coordinates.cache_clear()

    t = evaluate_terrain(10.0, 20.0)
    assert t.source == "unavailable"
    assert t.slope_deg is None
    assert t.roughness_m is None
    assert t.elevation_m is None

    patch = evaluate_terrain_patch(10.0, 20.0, size=25)
    assert patch["source"] == "unavailable"
    assert patch["elevation_m"] == []

    _build_risk_grid.cache_clear()
    cells = _build_risk_grid(15.0)["cells"]
    assert all(c["slope_deg"] is None for c in cells if c["lat"] > -75)
    _build_risk_grid.cache_clear()
    _evaluate_from_coordinates.cache_clear()
