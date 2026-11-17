"""Capas del polo sur: producto versionado, luz y Tierra por celda, zonas óptimas y rutas."""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import polar
from app.models.horizon import TerrainHorizon, get_dem
from app.models.site import Site
from app.models.terrain import HorizonMask, PolarDEM

DATE = datetime(2026, 11, 23, tzinfo=timezone.utc)
MASKS = Path(__file__).resolve().parents[1] / "data" / "horizons"
# (fila, columna): Mons Malapert, la celda de IM-2, el borde de Shackleton, el polo y una celda lejana.
CELLS = [(24, 74), (18, 107), (79, 74), (75, 75), (120, 30)]


@pytest.fixture(scope="module")
def grid():
    loaded = polar.load_grid()
    assert loaded is not None, "falta data/polar/south_pole.npz (./run.sh polar)"
    return loaded


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_la_grilla_esta_centrada_en_el_polo_y_cubre_los_sitios_polares(grid, catalog):
    assert grid.n == polar.GRID_N
    assert grid.lat[75, 75] == pytest.approx(-90.0, abs=1e-6)
    # La fila 0 mira a la Tierra (longitud 0°) y las columnas crecen hacia el este.
    assert abs(grid.lon[0, 75]) < 1e-6
    assert grid.lon[75, 150] == pytest.approx(90.0, abs=1e-6)
    for site_id in ("im-2", "mons-mouton", "mons-malapert", "shackleton-ridge", "change-7"):
        site = catalog[site_id]
        row, col = grid.cell_of(site.lat, site.lon)
        # El centro de la celda queda a menos de media diagonal del sitio.
        assert abs(grid.lat[row, col] - site.lat) < 0.08
    assert grid.cell_of(-80.13, 1.44) is None  # IM-1 queda fuera de la grilla


def test_el_relieve_guardado_coincide_con_el_dem(grid):
    dem = get_dem()
    if dem is None:
        pytest.skip("sin DEM polar (./run.sh data --dem)")
    heights = dem.height(grid.lat, grid.lon)
    assert np.abs(heights - grid.height_m).max() <= 0.51  # se guarda redondeado al metro


def test_el_horizonte_por_celda_coincide_con_las_mascaras_de_los_sitios():
    """El trazador de las capas debe dar lo mismo que el de las máscaras de 0,5° ya validadas."""
    dem = get_dem()
    if dem is None:
        pytest.skip("sin DEM polar (./run.sh data --dem)")
    for path in sorted(MASKS.glob("*.json")):
        mask = HorizonMask.load(path)
        line, sample = PolarDEM.pixel(np.array([mask.lat]), np.array([mask.lon]))
        traced = polar.horizon_from_dem(dem, line, sample)[0]
        azimuth = (np.arange(polar.HORIZON_DIRECTIONS) * 360.0 / polar.HORIZON_DIRECTIONS - mask.lon) % 360
        reference = np.interp(azimuth, np.append(mask.azimuths, 360), np.append(mask.elevation_deg, mask.elevation_deg[0]))
        assert np.abs(traced - reference).max() < 0.15, path.stem


@pytest.mark.parametrize("body,margin", [("sun", 0.0), ("earth", 2.0)])
def test_la_visibilidad_por_celda_coincide_con_el_motor_por_sitio(grid, ephemeris, body, margin):
    """Mismo horizonte, misma efeméride: el cálculo vectorizado no puede diferir del de un sitio."""
    series = polar.visibility(grid, ephemeris, body, DATE, 14 * 24, 2.0, margin)
    directions = grid.horizon_deg.shape[-1]
    for row, col in CELLS:
        lat, lon = float(grid.lat[row, col]), float(grid.lon[row, col])
        azimuth = np.arange(0, 360, 0.5)
        position = (azimuth + lon) % 360 * directions / 360
        low = np.floor(position).astype(int) % directions
        frac = position - np.floor(position)
        profile = grid.horizon_deg[row, col]
        mask = HorizonMask(lat, lon, 0.5, profile[low] * (1 - frac) + profile[(low + 1) % directions] * frac,
                           np.zeros(azimuth.size), 150.0, 2.0, "prueba")
        track = ephemeris.track(Site(id="celda", name="celda", lat=lat, lon=lon), body, DATE, 14 * 24, 2.0)
        expected = TerrainHorizon(mask, margin).is_visible(track.azimuth, track.elevation)
        mismatches = int((series.clear[row * grid.n + col] != expected).sum())
        assert mismatches <= 1, f"celda {(row, col)}: {mismatches} instantes distintos"


def test_horas_continuas_desde_cada_instante():
    clear = np.array([[1, 1, 0, 1, 1, 1], [0, 0, 0, 0, 0, 0]], dtype=bool)
    assert polar.continuous_from_start(clear).tolist() == [[2, 1, 0, 3, 2, 1], [0, 0, 0, 0, 0, 0]]


def test_la_sombra_permanente_esta_en_los_crateres_y_no_en_las_crestas(grid, catalog):
    assert 0.03 < grid.psr.mean() < 0.2
    # Dentro de Shackleton (89,67° S, 129,2° E) no llega el Sol; en la cresta de Malapert sí.
    assert grid.psr[grid.cell_of(-89.67, 129.2)]
    malapert = grid.cell_of(catalog["mons-malapert"].lat, catalog["mons-malapert"].lon)
    assert not grid.psr[malapert]
    assert grid.psr_distance_km[grid.psr].max() == 0
    assert grid.psr_distance_km[malapert] > 0


def test_la_grilla_reducida_conserva_las_coordenadas(grid):
    coarse = grid.coarse(2)
    assert coarse.n == 76 and coarse.cell_m == 2 * polar.CELL_M
    assert np.array_equal(coarse.lat, grid.lat[::2, ::2])
    assert coarse.cell_of(float(grid.lat[40, 100]), float(grid.lon[40, 100])) == (20, 50)


def test_api_relieve(client, grid):
    data = client.get("/api/polar/relief").json()
    cells = grid.n ** 2
    assert data["n"] == grid.n and data["cell_m"] == polar.CELL_M
    assert all(len(data[key]) == cells for key in ("height_m", "slope_deg_x10", "flat_pct", "psr"))
    assert data["provenance"]["slope"]["kind"] == "measured"
    assert data["provenance"]["sun"]["kind"] == "estimated"


def test_api_capas_zonas_optimas(client, grid):
    data = client.get("/api/polar/layers", params={"date": "2026-11-23T00:00:00Z"}).json()
    sun, earth, optimal = (np.array(data[key]) for key in ("sun_pct", "earth_pct", "optimal"))
    assert sun.size == grid.n ** 2 and 0 <= sun.min() and sun.max() <= 100
    # Zona óptima = los tres factores a la vez, con los umbrales que informa la respuesta.
    limits = data["thresholds"]
    expected = ((grid.flat_pct.ravel() >= limits["flat_pct"]) & (sun >= limits["sun_pct"]) & (earth >= limits["earth_pct"]))
    assert np.array_equal(optimal.astype(bool), expected)
    assert 0 < data["stats"]["optimal_pct"] < 15
    # Las celdas en sombra permanente no reciben luz en ninguna fecha.
    assert sun[grid.psr.ravel()].max() == 0
    # Del lado de la Tierra (filas de arriba) el enlace es frecuente; del lado oculto solo se asoma
    # desde alguna cumbre con la libración a favor.
    rows = earth.reshape(grid.n, grid.n)
    assert rows[:10].mean() > 30
    assert rows[-10:].mean() < 2


def test_api_capas_cambian_con_la_fecha(client):
    a = client.get("/api/polar/layers", params={"date": "2026-11-23T00:00:00Z"}).json()
    b = client.get("/api/polar/layers", params={"date": "2026-12-07T00:00:00Z"}).json()
    assert a["sun_pct"] != b["sun_pct"]
    assert a["earth_pct"] != b["earth_pct"]


def test_api_calendario_regional(client):
    data = client.get("/api/polar/availability", params={"date": "2026-11-23T13:00:00Z", "days": 60}).json()
    assert data["start"] == "2026-11-23T00:00:00Z"  # se redondea al día
    assert data["evaluated"] == len(data["dates"]) == 61
    assert len(data["available_pct"]) == data["n"] ** 2
    for day in data["dates"]:
        # Cumplir todo es más exigente que cumplir solo el Sol o solo la Tierra.
        assert day["area_pct"] <= min(day["sun_pct"], day["earth_pct"]) + 1e-9


def test_api_entorno_de_un_sitio(client):
    data = client.get("/api/sites/mons-malapert/environment", params={"date": "2026-11-23T00:00:00Z"}).json()
    kelvin = data["temperature"]["kelvin"]
    assert len(kelvin) == 14 * 24 + 1
    assert data["temperature"]["min_k"] >= 40 and data["temperature"]["max_k"] < 300  # Sol rasante en el polo
    assert data["shadow"]["in_permanent_shadow"] is False
    assert data["shadow"]["distance_km"] > 0
    # Fuera de la grilla polar no hay dato de sombra permanente, pero sí temperatura.
    apollo = client.get("/api/sites/apollo-11/environment", params={"date": "2026-11-23T00:00:00Z"}).json()
    assert apollo["shadow"] is None
    assert apollo["temperature"]["max_k"] > 300


def test_luz_y_tierra_a_largo_plazo_contra_los_mapas_de_pgda(grid, ephemeris):
    """Promedio de un ciclo nodal (18,6 años) contra NASA PGDA, celda por celda.

    Referencia: tests/data/pgda_polar_grid.npz (scripts/fetch_pgda_polar_grid.py). PGDA cuenta el
    cuerpo como visible si asoma cualquier parte del disco: se usa un margen de menos su radio.
    Medido el 16-11-2026 con la grilla completa y paso de 13 h: Sol, error medio absoluto de 0,8 puntos
    y correlación 0,996; Tierra, 1,0 puntos y 0,997. Aquí se prueba una de cada cuatro celdas.
    """
    reference = np.load(Path(__file__).parent / "data" / "pgda_polar_grid.npz")
    coarse = grid.coarse(4)
    start = datetime(2009, 1, 1, tzinfo=timezone.utc)
    hours = 24 * 365.25 * 18.6
    for body, disc_radius in (("sun", polar.SUN_DISC_RADIUS_DEG), ("earth", 0.95)):
        series = polar.visibility(coarse, ephemeris, body, start, hours, 29.0, -disc_radius)
        ours = series.clear.mean(axis=1) * 100
        official = reference[f"{body}_pct"][::4, ::4].ravel().astype(float)
        assert np.abs(ours - official).mean() < 2.0, body
        assert np.corrcoef(ours, official)[0, 1] > 0.99, body
        assert ((ours >= 50) == (official >= 50)).mean() > 0.98, body
