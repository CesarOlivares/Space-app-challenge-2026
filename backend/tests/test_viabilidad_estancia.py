"""Viabilidad con luz durante toda la estancia, pendiente máxima de 8° y criterios sin dato (P0)."""

from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.scoring import MAX_SLOPE_DEG, STAY_DAYS, ScoringConfig, evaluate

LANDING = datetime.fromisoformat("2026-11-20T23:00:00+00:00")
DEM_FILE = Path(__file__).resolve().parents[1] / "data" / "dem" / "ldem_75s_120m.img"
requires_dem = pytest.mark.skipif(not DEM_FILE.exists(), reason="falta el DEM: ./run.sh data --dem")


@pytest.fixture(scope="module")
def client(ephemeris):  # `ephemeris` omite estas pruebas si faltan los kernels
    with TestClient(app) as client:
        yield client


def test_valores_por_defecto_con_fuente():
    config = ScoringConfig()
    assert config.stay_days == STAY_DAYS == 6.5
    assert config.max_slope_deg == MAX_SLOPE_DEG == 8.0


def test_estancia_no_supera_la_ventana():
    assert ScoringConfig(window_days=3, stay_days=6.5).stay_hours == 72
    with pytest.raises(ValueError):
        ScoringConfig(stay_days=0)


def test_viable_exige_sol_durante_toda_la_estancia(ephemeris, catalog):
    site = catalog["apollo-11"]
    corta = evaluate(ephemeris, site, LANDING, ScoringConfig(stay_days=1))
    assert corta.sun.visible and corta.sun_through_stay and corta.viable
    # El Sol se pone antes de que termine una estancia más larga que la luz disponible.
    luz = corta.sun.hours_until_set
    assert luz is not None
    larga = evaluate(ephemeris, site, LANDING, ScoringConfig(stay_days=luz / 24 + 0.5))
    assert not larga.sun_through_stay
    assert not larga.viable


@requires_dem
def test_pendiente_sobre_8_grados_no_es_viable(ephemeris, catalog):
    # im-1 (Intuitive Machines, volcó al alunizar) tiene ~11,8° en el DEM de 120 m.
    result = evaluate(ephemeris, catalog["im-1"], LANDING)
    assert result.slope_deg > 8.0
    assert result.slope_ok is False
    assert not result.viable


@requires_dem
def test_criterios_con_peso_y_sin_dato_se_informan(ephemeris, catalog):
    sin_relieve = catalog["apollo-11"]
    por_defecto = evaluate(ephemeris, sin_relieve, LANDING)
    assert por_defecto.missing_criteria == ()  # terreno y protección pesan 0
    con_terreno = evaluate(ephemeris, sin_relieve, LANDING, ScoringConfig(weight_terrain=1.0, weight_protection=0.5))
    assert con_terreno.missing_criteria == ("terrain", "protection")
    polar = evaluate(ephemeris, catalog["mons-malapert"], LANDING, ScoringConfig(weight_terrain=1.0))
    assert polar.missing_criteria == ()


@requires_dem
def test_api_expone_estancia_y_criterios_faltantes(client):
    data = client.get("/api/scores", params={"date": "2026-11-20T23:00:00Z", "weight_terrain": 1.0}).json()
    assert data["config"]["stay_days"] == 6.5
    assert data["config"]["max_slope_deg"] == 8.0
    by_id = {s["site_id"]: s for s in data["scores"]}
    assert by_id["apollo-11"]["missing_criteria"] == ["terrain"]
    assert by_id["mons-malapert"]["missing_criteria"] == []
    assert isinstance(by_id["apollo-11"]["sun_through_stay"], bool)


def test_disponibilidad_es_coherente_con_viable(ephemeris, catalog):
    from app.models.scoring import availability, failing_requirements

    results = availability(ephemeris, catalog["apollo-11"], LANDING, 30, 24)
    assert len(results) == 31
    for r in results:
        assert (not failing_requirements(r)) == r.viable
    assert [r.landing for r in results] == sorted(r.landing for r in results)


def test_disponibilidad_limita_las_fechas(ephemeris, catalog):
    from app.models.scoring import availability

    with pytest.raises(ValueError):
        availability(ephemeris, catalog["apollo-11"], LANDING, 365, 0.5)


def test_api_disponibilidad(client):
    data = client.get("/api/sites/apollo-11/availability",
                      params={"date": "2026-01-01T00:00:00Z", "days": 60}).json()
    assert data["evaluated"] == len(data["dates"]) == 61
    assert data["available"] == sum(d["available"] for d in data["dates"])
    assert data["available_fraction"] == round(data["available"] / 61, 4)
    assert set(data["failing_counts"]) == {"sun", "earth", "slope"}
    assert all((not d["available"]) == bool(d["failing"]) for d in data["dates"])
    assert client.get("/api/sites/apollo-11/availability", params={"days": 400, "step_hours": 6}).status_code == 422
