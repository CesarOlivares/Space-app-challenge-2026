"""Ventanas de visibilidad a partir de una serie muestreada.

Todas las funciones reciben `hours` (horas desde el inicio, crecientes) y
`clearance` (grados por sobre el horizonte; positivo = visible). Los cruces
del horizonte se ubican por interpolación lineal entre muestras.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Interval:
    start_h: float
    end_h: float
    # True si el intervalo ya estaba en curso al inicio o sigue al final de la serie.
    open_start: bool = False
    open_end: bool = False

    @property
    def duration_h(self) -> float:
        return self.end_h - self.start_h


def visibility_intervals(hours: np.ndarray, clearance: np.ndarray) -> list[Interval]:
    hours = np.asarray(hours, dtype=float)
    clearance = np.asarray(clearance, dtype=float)
    above = clearance > 0

    intervals = []
    start = hours[0] if above[0] else None
    open_start = bool(above[0])
    for i in np.flatnonzero(above[1:] != above[:-1]):
        c0, c1 = clearance[i], clearance[i + 1]
        crossing = hours[i] + (hours[i + 1] - hours[i]) * c0 / (c0 - c1)
        if above[i + 1]:
            start = crossing
        else:
            intervals.append(Interval(start, crossing, open_start=open_start))
            start, open_start = None, False
    if start is not None:
        intervals.append(Interval(start, hours[-1], open_start=open_start, open_end=True))
    return intervals


def visible_hours(intervals: list[Interval]) -> float:
    return sum(interval.duration_h for interval in intervals)


def hours_until_set(hours: np.ndarray, clearance: np.ndarray) -> float | None:
    """Horas hasta que el cuerpo baja del horizonte.

    0 si no es visible al inicio; None si sigue visible durante toda la serie.
    """
    if clearance[0] <= 0:
        return 0.0
    first = visibility_intervals(hours, clearance)[0]
    return None if first.open_end else first.end_h - hours[0]


def hours_until_rise(hours: np.ndarray, clearance: np.ndarray) -> float | None:
    """Horas hasta que el cuerpo sube sobre el horizonte.

    0 si ya es visible al inicio; None si no sale durante toda la serie.
    """
    if clearance[0] > 0:
        return 0.0
    intervals = visibility_intervals(hours, clearance)
    return intervals[0].start_h - hours[0] if intervals else None
