"""Recalcula las cifras de ejemplo que cita la sección Aprender del frontend.

Los textos de `frontend/src/views/LearnView.js`, `learnContent.js` y `mock-learn.html` citan valores
concretos del modelo (porcentajes de visibilidad, pendientes, fechas viables). Si el modelo cambia,
se corre este script y se actualizan esos textos con lo que imprime.

Uso (desde backend/):
  python scripts/learn_facts.py            # JSON por la salida estándar
  python scripts/learn_facts.py --year 2027
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.ephemeris import Ephemeris  # noqa: E402
from app.models.horizon import horizon_for  # noqa: E402
from app.models.scoring import ScoringConfig, availability, evaluate, failing_requirements  # noqa: E402
from app.models.site import load_catalog  # noqa: E402

POLAR = ("im-1", "im-2", "mons-mouton", "mons-malapert", "shackleton-ridge", "change-7")
EXAMPLE_SITES = ("im-2", "mons-mouton", "im-1", "shackleton-ridge", "apollo-11")
EXAMPLE_DATE = datetime(2026, 12, 15, tzinfo=timezone.utc)


def at_date(ephemeris: Ephemeris, site, when: datetime) -> dict:
    r = evaluate(ephemeris, site, when)
    terrain_h = horizon_for(site, 0.0)
    return {
        "date": when.isoformat(),
        "sun_elevation_deg": round(r.sun.elevation_deg, 2),
        "sun_horizon_deg": round(float(terrain_h.elevation(np.array([r.sun.azimuth_deg]))[0]), 2),
        "sun_visible": r.sun.visible,
        "sun_through_stay": r.sun_through_stay,
        "earth_elevation_deg": round(r.earth.elevation_deg, 2),
        "earth_horizon_deg": round(float(terrain_h.elevation(np.array([r.earth.azimuth_deg]))[0]), 2),
        "earth_visible": r.earth.visible,
        "earth_fraction_pct": round(100 * r.earth.visible_fraction, 1),
        "sun_fraction_pct": round(100 * r.sun.visible_fraction, 1),
        "energy": r.energy,
        "communication": r.communication,
        "total": r.total,
        "slope_deg": r.slope_deg,
        "terrain_source": r.terrain.source,
        "sky_view_factor": r.sky_view_factor,
        "viable": r.viable,
        "failing": failing_requirements(r),
    }


def over_year(ephemeris: Ephemeris, site, year: int) -> dict:
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    results = availability(ephemeris, site, start, 365, 24.0)
    first_fail = Counter(failing_requirements(r)[0] for r in results if not r.viable)
    earth_elev = [r.earth.elevation_deg for r in results]
    return {
        "dates": len(results),
        "viable_pct": round(100 * sum(r.viable for r in results) / len(results), 1),
        "first_failing": dict(first_fail),
        "earth_visible_pct": round(100 * float(np.mean([r.earth.visible_fraction for r in results])), 1),
        "sun_visible_pct": round(100 * float(np.mean([r.sun.visible_fraction for r in results])), 1),
        "earth_elevation_min_mean_max_deg": [round(min(earth_elev), 2), round(float(np.mean(earth_elev)), 2),
                                             round(max(earth_elev), 2)],
        "earth_horizon_deg": round(float(horizon_for(site, 0.0).elevation(
            np.array([float(np.mean([r.earth.azimuth_deg for r in results]))]))[0]), 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--year", type=int, default=2027)
    args = parser.parse_args()

    ephemeris = Ephemeris(ROOT / "data" / "kernels")
    catalog = load_catalog(ROOT / "data" / "sites.json")
    config = ScoringConfig()
    out = {
        "config": {"earth_margin_deg": config.earth_margin_deg, "sun_margin_deg": config.sun_margin_deg,
                   "stay_days": config.stay_days, "max_slope_deg": config.max_slope_deg,
                   "window_days": config.window_days},
        "examples": {sid: at_date(ephemeris, catalog[sid], EXAMPLE_DATE) for sid in EXAMPLE_SITES},
        "apollo-11_2026-11-15": at_date(ephemeris, catalog["apollo-11"], datetime(2026, 11, 15, tzinfo=timezone.utc)),
        f"year_{args.year}": {sid: {"lat": catalog[sid].lat, **over_year(ephemeris, catalog[sid], args.year)}
                              for sid in POLAR},
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    main()
