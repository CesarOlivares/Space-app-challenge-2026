from fastapi.testclient import TestClient

from app.main import app

# Sin `with`: no corre el arranque, así que estas pruebas no necesitan los kernels.
client = TestClient(app)


def test_health_responde_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_raiz_sirve_el_frontend():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
