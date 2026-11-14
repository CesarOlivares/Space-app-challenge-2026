from datetime import datetime

import pytest

from app.models.scoring import (
    ScoringConfig,
    communication_score,
    energy_score,
    evaluate,
    total_score,
)

LANDING = datetime.fromisoformat("2026-12-01T00:00:00+00:00")


def test_extremos_de_energia():
    assert energy_score(1.0, 336, 336) == 100
    assert energy_score(0.0, 0, 336) == 0
    assert energy_score(0.5, 0, 336) == 25


def test_extremos_de_comunicacion():
    assert communication_score(1.0) == 100
    assert communication_score(0.0) == 0


def test_pesos_del_puntaje_global():
    assert total_score(80, 20, ScoringConfig()) == 50
    assert total_score(80, 20, ScoringConfig(weight_energy=1, weight_communication=0)) == 80


@pytest.mark.parametrize("kwargs", [
    {"window_days": 0},
    {"step_hours": -1},
    {"weight_energy": -1},
    {"weight_energy": 0, "weight_communication": 0},
])
def test_configuracion_invalida(kwargs):
    with pytest.raises(ValueError):
        ScoringConfig(**kwargs)


def test_cara_oculta_nunca_ve_la_tierra(ephemeris, catalog):
    result = evaluate(ephemeris, catalog["change-4"], LANDING)
    assert result.communication == 0
    assert result.earth.hours_until_rise is None
    assert not result.viable


def test_cara_visible_ve_la_tierra_siempre(ephemeris, catalog):
    result = evaluate(ephemeris, catalog["apollo-11"], LANDING)
    assert result.communication == 100
    assert result.earth.hours_until_set is None


def test_sitio_ecuatorial_de_noche_no_es_viable(ephemeris, catalog):
    # Horizons: el 1 de diciembre de 2026 el Sol está a -13° en Apollo 11.
    result = evaluate(ephemeris, catalog["apollo-11"], LANDING)
    assert not result.sun.visible
    assert not result.viable
    assert result.sun.hours_until_rise > 0


def test_orientacion_de_paneles(ephemeris, catalog):
    # 15/12/2026: amanece en Apollo 11 (Sol alto los días siguientes) y en IM-2 el Sol ronda los 2°.
    date = datetime.fromisoformat("2026-12-15T00:00:00+00:00")

    def energy(site_id, panel):
        return evaluate(ephemeris, catalog[site_id], date, ScoringConfig(panel=panel)).energy

    # Por tiempo de luz ambos saturan; con paneles planos el Sol bajo del polo rinde poco.
    assert energy("apollo-11", "tiempo") == energy("im-2", "tiempo") == 100
    assert energy("apollo-11", "horizontal") > energy("im-2", "horizontal") + 20
    # Con paneles verticales el polo aprovecha casi todo y el ecuador pierde con el Sol alto.
    assert energy("im-2", "vertical") > 99
    assert energy("apollo-11", "vertical") < energy("im-2", "vertical")


def test_panel_desconocido():
    with pytest.raises(ValueError):
        ScoringConfig(panel="diagonal")


def test_puntajes_en_rango(ephemeris, catalog):
    for site in catalog.values():
        result = evaluate(ephemeris, site, LANDING)
        for score in (result.energy, result.communication, result.total):
            assert 0 <= score <= 100
        assert result.sun.horizon == "esferico"
