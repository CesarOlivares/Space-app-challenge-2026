"""Modelo térmico de primer orden contra los valores que mide Diviner (Williams et al. 2017)."""

import numpy as np
import pytest

from app.models import thermal

NIGHT_HOURS = 14.75 * 24


def test_equilibrio_al_mediodia_ecuatorial():
    # Diviner: ~385-390 K en el punto subsolar.
    assert thermal.equilibrium_temperature(90.0) == pytest.approx(387, abs=6)


def test_equilibrio_con_sol_rasante_polar():
    # Con el Sol a 1,5° sobre el horizonte, una superficie horizontal queda muy por debajo de 0 °C.
    assert 140 < thermal.equilibrium_temperature(1.5) < 170


def test_sin_sol_queda_el_piso_de_calor():
    assert thermal.equilibrium_temperature(-5.0) == pytest.approx(thermal.FLOOR_TEMPERATURE_K, abs=0.1)


def test_la_noche_ecuatorial_termina_cerca_de_95_k():
    hours = np.arange(0, NIGHT_HOURS + 1, 1.0)
    dark = np.zeros(hours.size, dtype=bool)
    kelvin = thermal.temperature_series(hours, np.full(hours.size, -30.0), dark, initial_k=387.0)
    assert kelvin[-1] == pytest.approx(95, abs=8)
    assert np.all(np.diff(kelvin) <= 1e-9)  # sin Sol solo se enfría


def test_al_salir_el_sol_la_superficie_se_acerca_al_equilibrio():
    hours = np.arange(0, 49, 1.0)
    lit = np.ones(hours.size, dtype=bool)
    kelvin = thermal.temperature_series(hours, np.full(hours.size, 30.0), lit, initial_k=95.0)
    assert kelvin[-1] == pytest.approx(float(thermal.equilibrium_temperature(30.0)), abs=3)


def test_el_resultado_no_depende_del_paso_de_muestreo():
    fine = np.arange(0, 241, 0.5)
    coarse = np.arange(0, 241, 6.0)
    series = [thermal.temperature_series(h, np.full(h.size, -10.0), np.zeros(h.size, dtype=bool), initial_k=300.0)
              for h in (fine, coarse)]
    assert series[0][-1] == pytest.approx(series[1][-1], abs=0.5)
