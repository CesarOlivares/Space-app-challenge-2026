"""Lee la iluminación promedio oficial del Sol (NASA PGDA) en los sitios polares del catálogo.

Uso: .venv/bin/python scripts/fetch_pgda_sun_illumination.py

El mapa AVGVISIB_75S_120M_201608 (Mazarico et al. 2011) da, para cada
píxel del polo sur, la fracción del tiempo en que se ve alguna parte del disco
solar. Usa la misma grilla que el DEM LDEM_75S_120M del proyecto, así que
basta leer con peticiones parciales (HTTP Range) el píxel de cada sitio y sus
vecinos, sin bajar los 116 MB. El resultado se guarda en
tests/data/pgda_sun_illumination.json y se versiona: las pruebas no necesitan
conexión.
"""

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.site import load_catalog  # noqa: E402
from app.models.terrain import DEM_SIZE, PolarDEM  # noqa: E402

CATALOG = ROOT / "data" / "sites.json"
OUTPUT = ROOT / "tests" / "data" / "pgda_sun_illumination.json"
PRODUCT = "AVGVISIB_75S_120M_201608"
URL = f"https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/{PRODUCT}.IMG"
SCALING_FACTOR = 0.00004
NEIGHBORHOOD = 1  # 3×3 píxeles = 360 m de lado


def read_row(line: int, first_sample: int, count: int) -> np.ndarray:
    start = (line * DEM_SIZE + first_sample) * 2
    request = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{start + count * 2 - 1}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return np.frombuffer(response.read(), dtype="<i2") * SCALING_FACTOR


def main() -> None:
    sites = [s for s in load_catalog(CATALOG).values() if PolarDEM.covers(s.lat)]
    cases = []
    for site in sites:
        line, sample = PolarDEM.pixel(np.array(site.lat), np.array(site.lon))
        line, sample = int(round(float(line))), int(round(float(sample)))
        size = 2 * NEIGHBORHOOD + 1
        block = np.array([
            read_row(line + dl, sample - NEIGHBORHOOD, size)
            for dl in range(-NEIGHBORHOOD, NEIGHBORHOOD + 1)
        ])
        cases.append({
            "site_id": site.id,
            "lat": site.lat,
            "lon": site.lon,
            "pixel": [line, sample],
            "visibility": round(float(block[NEIGHBORHOOD, NEIGHBORHOOD]), 4),
            "neighborhood_min": round(float(block.min()), 4),
            "neighborhood_max": round(float(block.max()), 4),
        })
        print(f"{site.id:20s} {cases[-1]['visibility']:.3f} ({cases[-1]['neighborhood_min']:.3f}–{cases[-1]['neighborhood_max']:.3f})")

    OUTPUT.write_text(json.dumps({
        "source": f"NASA PGDA {PRODUCT} (Mazarico et al. 2011), {URL}",
        "definition": "Fracción del tiempo con alguna parte del disco solar visible",
        "neighborhood_px": size,
        "cases": cases,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(cases)} sitios -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
