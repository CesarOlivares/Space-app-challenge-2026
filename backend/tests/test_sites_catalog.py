import json
import re
from pathlib import Path

import pytest

CATALOG = Path(__file__).resolve().parents[1] / "data" / "sites.json"
SITES = json.loads(CATALOG.read_text(encoding="utf-8"))["sites"]

REQUIRED = {
    "id", "name", "mission", "agency", "country", "year",
    "category", "lat", "lon", "elevation_m", "precision", "source",
}
CATEGORIES = {"historico", "reciente", "candidato"}
PRECISIONS = {"lander", "punto_de_interes", "centro_de_rasgo", "aproximada"}


def test_ids_unicos():
    ids = [site["id"] for site in SITES]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("site", SITES, ids=lambda s: s["id"])
def test_sitio_valido(site):
    assert REQUIRED <= site.keys()
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", site["id"])
    assert -90 <= site["lat"] <= 90
    assert -180 <= site["lon"] <= 180
    assert site["category"] in CATEGORIES
    assert site["precision"] in PRECISIONS
    assert site["source"]["name"]
    assert site["source"]["url"].startswith("https://")


def test_hay_sitios_del_polo_sur():
    polares = [s for s in SITES if s["lat"] <= -75]
    assert len(polares) >= 5
