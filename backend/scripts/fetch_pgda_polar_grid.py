"""Lee los mapas oficiales de NASA PGDA en los centros de las celdas de las capas polares.

Uso: .venv/bin/python scripts/fetch_pgda_polar_grid.py

Los productos AVGVISIB_75S_120M_201608 (Sol) y su versión _EARTH (Mazarico et al. 2011) usan
la misma grilla del DEM LDEM_75S_120M. El centro de cada celda de las capas polares cae entre
cuatro píxeles: se leen con peticiones parciales (HTTP Range) las dos filas vecinas y se
promedian los cuatro, sin bajar los 116 MB de cada mapa. El resultado se guarda en
tests/data/pgda_polar_grid.npz y se versiona: las pruebas no necesitan conexión.
"""

import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.polar import GRID_N, cell_coordinates  # noqa: E402
from app.models.terrain import DEM_SIZE  # noqa: E402

OUTPUT = ROOT / "tests" / "data" / "pgda_polar_grid.npz"
BASE = "https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG"
PRODUCTS = {"sun": "AVGVISIB_75S_120M_201608", "earth": "AVGVISIB_75S_120M_201608_EARTH"}
SCALING_FACTOR = 0.00004


def read_row(url: str, line: int, first_sample: int, count: int) -> np.ndarray:
    start = (line * DEM_SIZE + first_sample) * 2
    request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + count * 2 - 1}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return np.frombuffer(response.read(), dtype="<i2") * SCALING_FACTOR


def main() -> None:
    _, _, line, sample = cell_coordinates(GRID_N)
    lines = np.floor(line[:, 0]).astype(int)
    samples = np.floor(sample[0]).astype(int)
    first, count = int(samples[0]), int(samples[-1] - samples[0] + 2)
    out = {}
    for body, product in PRODUCTS.items():
        url = f"{BASE}/{product}.IMG"
        grid = np.empty((GRID_N, GRID_N), dtype=np.float32)
        for i, top in enumerate(lines):
            rows = np.stack([read_row(url, int(top) + d, first, count) for d in (0, 1)])
            columns = samples - first
            grid[i] = (rows[:, columns] + rows[:, columns + 1]).mean(axis=0) / 2
            if i % 25 == 0:
                print(f"  {body}: fila {i + 1}/{GRID_N}")
        out[f"{body}_pct"] = np.rint(grid * 100).astype(np.uint8)
        print(f"{body}: media {grid.mean() * 100:.1f} % ({product})")
    np.savez_compressed(OUTPUT, **out)
    print(f"{OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
