import time

import pytest
from fastapi.testclient import TestClient

from app.main import app

DATE = "2026-12-15T00:00:00Z"


@pytest.fixture(scope="module")
def client(ephemeris):  # `ephemeris` omite estas pruebas si faltan los kernels
    with TestClient(app) as client:
        yield client


def test_sites(client):
    sites = client.get("/api/sites").json()["sites"]
    assert len(sites) == 22
    assert sites[0]["source"]["url"].startswith("https://")


def test_scores_de_todo_el_catalogo(client):
    data = client.get("/api/scores", params={"date": DATE}).json()
    assert data["date"] == DATE
    assert data["config"]["step_hours"] == 2.0
    assert len(data["scores"]) == 22
    first = data["scores"][0]
    assert set(first) == {"site_id", "date", "viable", "scores", "sun", "earth"}
    assert set(first["sun"]) == {"azimuth_deg", "elevation_deg", "visible"}


def test_scores_responde_en_menos_de_un_segundo(client):
    # RNF-01, con una fecha que no está en caché.
    start = time.perf_counter()
    response = client.get("/api/scores", params={"date": "2027-03-01T07:00:00Z"})
    assert response.status_code == 200
    assert time.perf_counter() - start < 1.0


def test_pesos_cambian_el_puntaje_global(client):
    def total(**params):
        data = client.get("/api/scores", params={"date": DATE, **params}).json()
        return {s["site_id"]: s["scores"]["total"] for s in data["scores"]}["change-4"]

    assert total(weight_energy=1, weight_communication=0) > total()


@pytest.mark.parametrize("ref", ["im-2", "-84.7906,29.1957"])
def test_sky_para_catalogo_y_coordenadas(client, ref):
    data = client.get(f"/api/sites/{ref}/sky", params={"date": DATE}).json()
    assert data["site"]["lat"] == pytest.approx(-84.7906)
    assert data["horizon"]["kind"] == data["sun"]["horizon"]
    assert {"hours_until_set", "set_time", "windows"} <= data["earth"].keys()


def test_sky_incluye_el_perfil_del_terreno(client):
    terrain = client.get("/api/sites/im-2/sky", params={"date": DATE}).json()["horizon"]
    assert terrain["kind"] == "terreno"
    assert len(terrain["profile_deg"]) == 360
    sphere = client.get("/api/sites/apollo-11/sky", params={"date": DATE}).json()["horizon"]
    assert sphere == {"kind": "esferico", "profile_deg": None}


def test_sky_tiempo_hasta_ocaso(client):
    # Apollo 17 al 15/12/2026: el Sol se pone dentro de la ventana de 14 días.
    sun = client.get("/api/sites/apollo-17/sky", params={"date": DATE}).json()["sun"]
    assert sun["visible"]
    assert 0 < sun["hours_until_set"] < 14 * 24
    assert sun["set_time"] > DATE


def test_timeline(client):
    data = client.get("/api/sites/apollo-11/timeline",
                      params={"date": DATE, "days": 2, "step_hours": 6}).json()
    assert len(data["times"]) == 9
    assert len(data["sun"]["elevation_deg"]) == 9
    assert data["times"][0] == DATE


def test_illumination(client):
    data = client.get("/api/illumination", params={"date": DATE}).json()
    assert data["date"] == DATE
    assert -2 < data["subsolar"]["lat"] < 2  # el eje lunar está inclinado solo 1,5° respecto de la eclíptica
    assert {"lat", "lon"} == data["subearth"].keys()


def test_compare(client):
    body = {"scenarios": [{"site": "im-2", "date": DATE},
                          {"site": "-89.5,120", "date": "2027-01-10T00:00:00Z"}]}
    results = client.post("/api/compare", json=body).json()["results"]
    assert [r["site"]["id"] for r in results] == ["im-2", "custom:-89.5000,120.0000"]
    assert results[1]["date"] == "2027-01-10T00:00:00Z"


@pytest.mark.parametrize("method, url, kwargs, status", [
    ("get", "/api/sites/no-existe/sky", {}, 404),
    ("get", "/api/sites/95,0/sky", {}, 422),
    ("get", "/api/sites/0,abc/sky", {}, 404),
    ("get", "/api/scores", {"params": {"date": "ayer"}}, 422),
    ("get", "/api/scores", {"params": {"weight_energy": 0, "weight_communication": 0}}, 422),
    ("get", "/api/scores", {"params": {"window_days": 100}}, 422),
    ("get", "/api/sites/im-2/timeline", {"params": {"days": 60, "step_hours": 0.25}}, 422),
    ("post", "/api/compare", {"json": {"scenarios": [{"site": "im-2", "date": DATE}]}}, 422),
    ("post", "/api/compare", {"json": {"scenarios": [{"site": "im-2", "date": DATE},
                                                     {"site": "x", "date": DATE}]}}, 404),
])
def test_errores_de_entrada_claros(client, method, url, kwargs, status):
    response = getattr(client, method)(url, **kwargs)
    assert response.status_code == status
    assert response.json()["detail"]
