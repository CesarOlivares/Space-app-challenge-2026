"""Genera los casos de referencia de JPL Horizons para validar el modelo de efemérides.

Uso: .venv/bin/python scripts/fetch_horizons_cases.py

Para cada sitio y cuerpo (Sol, Tierra) pide a Horizons el azimut y la elevación
aparentes vistos desde la superficie lunar, y guarda el resultado en
tests/data/horizons_cases.json. El archivo se versiona: las pruebas no
necesitan conexión. Solo hace falta volver a correr esto si cambian los casos.
"""

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "sites.json"
OUTPUT = ROOT / "tests" / "data" / "horizons_cases.json"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Ecuatoriales, latitudes medias, cara oculta y polo sur.
SITE_IDS = ["apollo-11", "change-4", "chandrayaan-3", "im-1", "im-2", "shackleton-ridge"]
BODIES = {"sun": "10", "earth": "399"}

# Un mes sinódico (~29,5 días) cada 36 h cubre día y noche lunar con 20 muestras.
START = "2026-12-01 00:00"
STOP = "2026-12-30 12:00"
STEP = "36h"


def query(body: str, lat: float, lon: float) -> list[dict]:
    params = {
        "format": "json",
        "COMMAND": f"'{body}'",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "GEODETIC",
        # Altitud 0: el modelo trabaja sobre la esfera de referencia de 1737,4 km.
        "SITE_COORD": f"'{lon},{lat},0'",
        "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "DEG",
        "EXTRA_PREC": "YES",
        "CSV_FORMAT": "YES",
        "TIME_TYPE": "UT",
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=120) as response:
        result = json.load(response)["result"]
    if "$$SOE" not in result:
        raise RuntimeError(f"Horizons no devolvió datos:\n{result[-2000:]}")

    rows = []
    table = result.split("$$SOE")[1].split("$$EOE")[0]
    for line in table.strip().splitlines():
        cols = [c.strip() for c in line.split(",")]
        # Columnas: fecha, marca solar, marca de cuerpo interferente, azimut, elevación.
        when = datetime.strptime(cols[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        rows.append({
            "utc": when.isoformat().replace("+00:00", "Z"),
            "azimuth_deg": float(cols[3]),
            "elevation_deg": float(cols[4]),
        })
    return rows


def main() -> int:
    sites = {s["id"]: s for s in json.loads(CATALOG.read_text(encoding="utf-8"))["sites"]}
    cases = []
    for site_id in SITE_IDS:
        site = sites[site_id]
        for name, code in BODIES.items():
            print(f"  {site_id:18} {name}")
            for row in query(code, site["lat"], site["lon"]):
                cases.append({"site_id": site_id, "lat": site["lat"], "lon": site["lon"],
                              "body": name, **row})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "source": "JPL Horizons API (https://ssd.jpl.nasa.gov/horizons/)",
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "settings": {
            "center": "coord@301 (superficie lunar, marco MEAN_ME, esfera de 1737,4 km)",
            "site_altitude_km": 0,
            "quantities": "4: azimut y elevación aparentes, sin refracción (sin atmósfera)",
            "azimuth": "grados desde el norte hacia el este",
            "range": f"{START} a {STOP} UT, paso {STEP}",
        },
        "cases": cases,
    }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(cases)} casos guardados en {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
