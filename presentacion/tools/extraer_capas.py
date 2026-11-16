"""Datos de las capas para la animación explicativa -> src/capas.js (+ assets/lola.webp).
- Grilla global 72×36 calculada con el mismo código del backend (pendiente medida; Sol, señal y aptitud estimados).
- Parche de terreno 25×25 de Mons Malapert (23 nov 2026) tomado de las respuestas grabadas del backend.
- Relieve LOLA de 8 bits (el que usa la app para colorear la topografía).
Uso: cd backend && .venv/bin/python ../presentacion/tools/extraer_capas.py"""
import json, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, "..", "backend"))
from app.controllers.scores import _build_risk_grid
from PIL import Image
g = _build_risk_grid()
n = lambda v: -1 if v is None else round(v)
out = {"cols": g["cols"], "rows": g["rows"], "slope": [n(c["slope_deg"]) for c in g["cells"]], "solar": [n(c["solar_exposure"]) for c in g["cells"]],
       "comm": [n(c["earth_comm"]) for c in g["cells"]], "suit": [n(c["suitability"]) for c in g["cells"]]}
s = open(f"{R}/src/app-demo/fixtures.js").read(); fx = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
p = next(v for k, v in fx.items() if k.startswith("/api/sites/mons-malapert/patch?date=2026-11-23"))
r1 = lambda m: [[round(x, 1) if x is not None else None for x in row] for row in m]
out["patch"] = {"size": p["size"], "spacing": p["spacing_m"], "elev": r1(p["elevation_m"]), "slope": r1(p["slope_deg"]), "sun": r1(p["solar"]["exposure_pct"]),
                "meanSun": p["solar"]["mean_solar_pct"], "optimal": p["solar"]["optimal_landing_pct"]}
open(f"{R}/src/capas.js", "w").write("window.ZENITH_CAPAS = " + json.dumps(out, separators=(",", ":")) + ";\n")
Image.open(f"{R}/../frontend/public/textures/ldem_3_8bit.jpg").convert("L").save(f"{R}/assets/lola.webp", quality=85, method=6)
print("capas.js", os.path.getsize(f"{R}/src/capas.js") // 1024, "KB · lola.webp", os.path.getsize(f"{R}/assets/lola.webp") // 1024, "KB", Image.open(f"{R}/assets/lola.webp").size)
