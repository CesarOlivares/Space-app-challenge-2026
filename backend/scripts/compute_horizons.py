"""Precalcula las máscaras de horizonte por terreno de los sitios polares del catálogo.

Uso: ./run.sh horizons   (requiere ./run.sh data --dem)

Escribe data/horizons/<id>.json para cada sitio que el DEM cubre con
MAX_DISTANCE_KM de margen. Los archivos se versionan: la aplicación los usa
sin necesitar el DEM de 116 MB.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.terrain import MAX_DISTANCE_KM, PolarDEM, compute_mask  # noqa: E402

CATALOG = ROOT / "data" / "sites.json"
DEM_DIR = ROOT / "data" / "dem"
OUTPUT = ROOT / "data" / "horizons"


def main() -> int:
    dem = PolarDEM.open(DEM_DIR)
    if dem is None:
        print("Falta el DEM: ejecuta ./run.sh data --dem", file=sys.stderr)
        return 1

    OUTPUT.mkdir(parents=True, exist_ok=True)
    sites = json.loads(CATALOG.read_text(encoding="utf-8"))["sites"]
    for site in sites:
        if not PolarDEM.covers(site["lat"]):
            continue
        mask = compute_mask(dem, site["lat"], site["lon"])
        path = OUTPUT / f"{site['id']}.json"
        path.write_text(json.dumps(mask.to_json(site["id"]), ensure_ascii=False) + "\n", encoding="utf-8")
        e = mask.elevation_deg
        print(f"  {site['id']:18} horizonte {e.min():6.2f}° a {e.max():5.2f}°")
    print(f"Máscaras en {OUTPUT.relative_to(ROOT)} (radio {MAX_DISTANCE_KM:.0f} km)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
