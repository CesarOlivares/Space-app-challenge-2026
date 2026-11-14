"""Posición del Sol y la Tierra vistos desde un punto de la superficie lunar.

Usa los kernels del JPL (DE440 y la orientación lunar asociada), por lo que
incluye la libración y las variaciones orbitales reales de la Luna.

Convenciones, iguales a las de JPL Horizons:
- Coordenadas del sitio en el marco Mean Earth/Polar Axis (ME), sobre la
  esfera de referencia de 1737,4 km.
- Azimut en grados desde el norte hacia el este, en [0, 360).
- Elevación en grados respecto del plano perpendicular a la vertical local.
  Sin refracción: la Luna no tiene atmósfera.

Se omiten el tiempo de luz y la aberración: frente a Horizons el error es
menor a 0,01°, muy por debajo de la tolerancia de 0,5° (RNF-03).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.planetarylib import PlanetaryConstants

from app.models.site import Site

MOON_RADIUS_KM = 1737.4
BODIES = ("sun", "earth")

SPK_FILE = "de440s.bsp"
FRAME_KERNEL = "moon_de440_250416.tf"
TEXT_PCK = "pck00011.tpc"
BINARY_PCK = "moon_pa_de440_200625.bpc"
MOON_PA_FRAME_ID = 31008
MOON_ME_FRAME = "MOON_ME_DE440_ME421"
J2000_JD = 2451545.0


def as_utc(when: datetime) -> datetime:
    """Normaliza a UTC; una fecha sin zona horaria se interpreta como UTC."""
    if when.tzinfo is None:
        return when.replace(tzinfo=timezone.utc)
    return when.astimezone(timezone.utc)


@dataclass(frozen=True)
class Track:
    """Serie temporal de la posición de un cuerpo desde un sitio."""

    body: str
    start: datetime
    hours: np.ndarray  # horas desde start
    azimuth: np.ndarray
    elevation: np.ndarray


class Ephemeris:
    def __init__(self, kernels_dir: Path):
        kernels_dir = Path(kernels_dir)
        missing = [name for name in (SPK_FILE, FRAME_KERNEL, TEXT_PCK, BINARY_PCK)
                   if not (kernels_dir / name).exists()]
        if missing:
            raise FileNotFoundError(
                f"faltan kernels en {kernels_dir}: {', '.join(missing)}. Ejecuta ./run.sh data"
            )

        load = Loader(str(kernels_dir), verbose=False)
        self._ts = load.timescale(builtin=True)
        planets = load(SPK_FILE)
        self._moon = planets["moon"]
        self._bodies = {"sun": planets["sun"], "earth": planets["earth"]}

        constants = PlanetaryConstants()
        constants.read_text(load(FRAME_KERNEL))
        constants.read_text(load(TEXT_PCK))
        constants.read_binary(load(BINARY_PCK))
        # El kernel trae dos segmentos (1550–2426 y 2426–2650) y Skyfield se queda
        # con el último que lee; se fuerza el que cubre la época actual.
        constants._segment_map[MOON_PA_FRAME_ID] = next(
            segment for segment in constants._segment_list
            if segment.body == MOON_PA_FRAME_ID
            and segment.initial_jd <= J2000_JD <= segment.final_jd
        )
        self._frame = constants.build_frame_named(MOON_ME_FRAME)

    def track(self, site: Site, body: str, start: datetime,
              duration_h: float, step_h: float) -> Track:
        """Azimut y elevación de `body` desde `site`, cada `step_h` horas durante `duration_h`."""
        if body not in BODIES:
            raise ValueError(f"cuerpo desconocido: {body}; opciones: {', '.join(BODIES)}")
        if step_h <= 0 or duration_h < 0:
            raise ValueError("step_h debe ser positivo y duration_h no negativo")

        start = as_utc(start)
        count = int(np.floor(duration_h / step_h + 1e-9)) + 1
        moon, bodies, rotation = self._geometry(start, count, step_h)

        lat, lon = np.radians(site.lat), np.radians(site.lon)
        up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
        east = np.array([-np.sin(lon), np.cos(lon), 0.0])
        north = np.cross(up, east)

        # Posición del sitio en ICRF: centro de la Luna + radio rotado desde el marco ME.
        site_icrf = moon + np.einsum("jin,j->in", rotation, up * MOON_RADIUS_KM)
        local = np.einsum("ijn,jn->in", rotation, bodies[body] - site_icrf)
        local /= np.linalg.norm(local, axis=0)

        elevation = np.degrees(np.arcsin(np.clip(up @ local, -1.0, 1.0)))
        azimuth = np.degrees(np.arctan2(east @ local, north @ local)) % 360.0
        return Track(body, start, np.arange(count) * step_h, azimuth, elevation)

    def position(self, site: Site, body: str, when: datetime) -> tuple[float, float]:
        """(azimut, elevación) de `body` desde `site` en un instante."""
        track = self.track(site, body, when, 0.0, 1.0)
        return float(track.azimuth[0]), float(track.elevation[0])

    def subpoint(self, body: str, when: datetime) -> tuple[float, float]:
        """(lat, lon) del punto de la Luna que tiene a `body` en el cenit.

        El punto subsolar ubica el terminador; el punto subterrestre muestra la libración.
        """
        if body not in BODIES:
            raise ValueError(f"cuerpo desconocido: {body}; opciones: {', '.join(BODIES)}")
        moon, bodies, rotation = self._geometry(as_utc(when), 1, 1.0)
        direction = rotation[:, :, 0] @ (bodies[body][:, 0] - moon[:, 0])
        x, y, z = direction / np.linalg.norm(direction)
        return float(np.degrees(np.arcsin(z))), float(np.degrees(np.arctan2(y, x)))

    @lru_cache(maxsize=64)
    def _geometry(self, start: datetime, count: int, step_h: float):
        """Parte independiente del sitio; se reutiliza para todos los sitios de una fecha."""
        times = self._ts.from_datetimes(
            [start + timedelta(hours=i * step_h) for i in range(count)]
        )
        moon = self._moon.at(times).position.km
        bodies = {name: body.at(times).position.km for name, body in self._bodies.items()}
        rotation = self._frame.rotation_at(times)
        return moon, bodies, rotation
