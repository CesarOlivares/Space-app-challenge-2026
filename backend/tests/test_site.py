import pytest

from app.models.site import custom_site


def test_carga_el_catalogo_completo(catalog):
    assert len(catalog) == 22
    apollo = catalog["apollo-11"]
    assert apollo.lat == pytest.approx(0.67416)
    assert apollo.source_url.startswith("https://")


def test_sitio_personalizado():
    site = custom_site(-89.5, 120.0)
    assert site.id == "custom:-89.5000,120.0000"
    assert site.category == "personalizado"


@pytest.mark.parametrize("lat, lon", [(-90.1, 0), (91, 0), (0, 180.5), (0, -181)])
def test_rechaza_coordenadas_fuera_de_rango(lat, lon):
    with pytest.raises(ValueError):
        custom_site(lat, lon)
