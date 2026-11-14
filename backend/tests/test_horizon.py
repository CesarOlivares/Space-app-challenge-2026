import numpy as np

from app.models.horizon import SphericalHorizon, TerrainHorizon, horizon_for
from app.models.terrain import HorizonMask
from app.models.site import custom_site


def test_horizonte_esferico_es_cero():
    horizon = SphericalHorizon()
    np.testing.assert_array_equal(horizon.elevation(np.array([0, 90, 270])), [0, 0, 0])


def test_visible_solo_sobre_el_horizonte():
    horizon = SphericalHorizon()
    visible = horizon.is_visible(np.zeros(3), np.array([-0.1, 0.0, 0.1]))
    np.testing.assert_array_equal(visible, [False, False, True])


def test_margen_exige_mas_elevacion():
    horizon = SphericalHorizon(margin_deg=5)
    visible = horizon.is_visible(np.zeros(2), np.array([4.9, 5.1]))
    np.testing.assert_array_equal(visible, [False, True])


def test_sitio_ecuatorial_usa_horizonte_esferico():
    assert horizon_for(custom_site(0, 0)).kind == "esferico"


def test_sitio_polar_del_catalogo_usa_mascara_precalculada(catalog):
    # No necesita el DEM: la máscara está versionada en data/horizons/.
    horizon = horizon_for(catalog["im-2"])
    assert isinstance(horizon, TerrainHorizon)
    assert horizon.mask.source.startswith("LOLA")


def test_mascara_interpola_y_da_la_vuelta():
    mask = HorizonMask(lat=-85, lon=0, azimuth_step_deg=90, elevation_deg=np.array([0.0, 4.0, 2.0, 6.0]),
                       distance_km=np.zeros(4), max_distance_km=150, observer_height_m=2, source="prueba")
    horizon = TerrainHorizon(mask, margin_deg=1)
    np.testing.assert_allclose(horizon.elevation(np.array([45, 90, 315, 360, -45])), [3, 5, 4, 1, 4])
