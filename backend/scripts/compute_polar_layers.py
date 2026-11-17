"""Precalcula las capas del polo sur (relieve, pendiente y horizonte por celda).

Uso: ./run.sh polar   (requiere ./run.sh data --dem)

Escribe data/polar/south_pole.npz, que se versiona: la aplicación dibuja el relieve 3D, la
luz, la visibilidad de la Tierra y las zonas óptimas sin necesitar el DEM de 116 MB.
Qué contiene y cómo se calcula: app/models/polar.py y docs/modelo/08-capas-polares.md.
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.polar import CELL_M, DATA_FILE, build_grid, save_grid  # noqa: E402
from app.models.terrain import PolarDEM  # noqa: E402

DEM_DIR = ROOT / "data" / "dem"


def main() -> int:
    dem = PolarDEM.open(DEM_DIR)
    if dem is None:
        print("Falta el DEM: ejecuta ./run.sh data --dem", file=sys.stderr)
        return 1
    started = time.perf_counter()
    grid = build_grid(dem)
    save_grid(grid)
    print(f"  {grid.n}×{grid.n} celdas de {CELL_M / 1000:.1f} km (±{grid.half_extent_km:.0f} km del polo, "
          f"hasta {grid.lat.max():.2f}°)")
    print(f"  altura {grid.height_m.min():.0f} a {grid.height_m.max():.0f} m · "
          f"pendiente media {grid.slope_deg.mean():.1f}° · sombra permanente {grid.psr.mean() * 100:.1f} % de las celdas")
    print(f"{DATA_FILE.relative_to(ROOT)} ({DATA_FILE.stat().st_size // 1024} KB, {time.perf_counter() - started:.0f} s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
