from datetime import datetime

import numpy as np
import pytest

from app.models.horizon import SphericalHorizon
from app.models.windows import (
    hours_until_rise,
    hours_until_set,
    visibility_intervals,
    visible_hours,
)

HOURS = np.arange(0, 49, 1.0)


def test_interpola_los_cruces():
    # Sobre el horizonte entre las horas 10 y 30.
    clearance = -(HOURS - 10) * (HOURS - 30)
    [interval] = visibility_intervals(HOURS, clearance)
    assert interval.start_h == pytest.approx(10)
    assert interval.end_h == pytest.approx(30)
    assert not interval.open_start and not interval.open_end


def test_intervalos_abiertos_en_los_bordes():
    clearance = np.cos(HOURS / 48 * 2 * np.pi)  # visible al inicio y al final
    first, last = visibility_intervals(HOURS, clearance)
    assert first.open_start and first.start_h == 0
    assert last.open_end and last.end_h == 48
    assert visible_hours([first, last]) == pytest.approx(24, abs=0.1)


def test_tiempo_hasta_ocaso_y_salida():
    clearance = 30 - HOURS  # visible hasta la hora 30
    assert hours_until_set(HOURS, clearance) == pytest.approx(30)
    assert hours_until_rise(HOURS, clearance) == 0
    assert hours_until_set(HOURS, -clearance) == 0
    assert hours_until_rise(HOURS, -clearance) == pytest.approx(30)


def test_sin_cruces():
    assert hours_until_set(HOURS, np.ones_like(HOURS)) is None
    assert hours_until_rise(HOURS, -np.ones_like(HOURS)) is None
    assert visibility_intervals(HOURS, -np.ones_like(HOURS)) == []


def test_ocaso_real_no_depende_del_muestreo(ephemeris, catalog):
    """El ocaso calculado con muestras cada 2 h difiere en minutos del calculado cada 5 min."""
    site = catalog["apollo-11"]
    start = datetime.fromisoformat("2026-12-10T00:00:00+00:00")
    horizon = SphericalHorizon()

    def sunset(step_h):
        track = ephemeris.track(site, "sun", start, 30 * 24, step_h)
        clearance = horizon.clearance(track.azimuth, track.elevation)
        intervals = visibility_intervals(track.hours, clearance)
        return next(i.end_h for i in intervals if not i.open_end)

    assert sunset(2.0) == pytest.approx(sunset(5 / 60), abs=0.25)
