import numpy as np

from app.models.horizon import SphericalHorizon, horizon_for
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


def test_horizon_for_informa_el_tipo():
    assert horizon_for(custom_site(-89, 0)).kind == "esferico"
