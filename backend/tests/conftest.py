from pathlib import Path

import pytest

from app.models.ephemeris import Ephemeris
from app.models.site import load_catalog

DATA = Path(__file__).resolve().parents[1] / "data"


@pytest.fixture(scope="session")
def ephemeris():
    try:
        return Ephemeris(DATA / "kernels")
    except FileNotFoundError as error:
        pytest.skip(str(error))


@pytest.fixture(scope="session")
def catalog():
    return load_catalog(DATA / "sites.json")
