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
# Relieve del polo sur: ventana de ±142 km del DEM LOLA 120 m (incluye Mons Malapert), en bloques de 21×21 px (≈2,5 km).
# Altura = media del bloque; pendiente = media de la pendiente a 120 m dentro del bloque.
# Luz y Tierra: horizonte del relieve (con curvatura lunar) hacia el Sol en 72 longitudes (declinación +0,5°)
# y hacia la Tierra con libración de ±6,5°. Es una estimación geométrica de Zenith, no un dato oficial.
import numpy as np
from app.models.terrain import PolarDEM, _DEM_DIR, DEM_SIZE, DEM_SCALE_M, DEM_HEIGHT_SCALE
dem = PolarDEM.open(_DEM_DIR); B, N = 21, 113; c = DEM_SIZE // 2; h0 = c - B * N // 2
z = np.asarray(dem.data[h0:h0 + B * N, h0:h0 + B * N], dtype=np.float32) * DEM_HEIGHT_SCALE
gy, gx = np.gradient(z, DEM_SCALE_M); sl = np.degrees(np.arctan(np.hypot(gx, gy)))
blk = lambda a: a.reshape(N, B, N, B).mean(axis=(1, 3))
H, SL = blk(z), blk(sl); cell = B * DEM_SCALE_M; RM = 1737400.0
ii, jj = np.mgrid[0:N, 0:N]; dl = (ii - (N - 1) / 2) * cell; ds = (jj - (N - 1) / 2) * cell   # línea hacia abajo, muestra a la derecha
rho = np.hypot(dl, ds); colat = np.degrees(rho / RM); lon = np.degrees(np.arctan2(ds, -dl))
def horizonte(lam):   # ángulo del horizonte (°) mirando hacia la longitud lam, desde cada celda
    dy, dx = -np.cos(np.radians(lam)), np.sin(np.radians(lam)); best = np.full((N, N), -90.0)
    for k in range(1, 70):
        r = np.rint(ii + dy * k).astype(int); q = np.rint(jj + dx * k).astype(int); ok = (r >= 0) & (r < N) & (q >= 0) & (q < N)
        d = k * cell; hh = np.where(ok, H[np.clip(r, 0, N - 1), np.clip(q, 0, N - 1)], -1e9)
        best = np.maximum(best, np.degrees(np.arctan((hh - H - d * d / (2 * RM)) / d)))
    return best
lams = np.arange(0, 360, 5); hor = {l: horizonte(l) for l in lams}
sun = np.mean([(0.5 + colat * np.cos(np.radians(l - lon))) > hor[l] for l in lams], axis=0) * 100
ear = np.mean([(de + colat * np.cos(np.radians(le - lon))) > hor[round(le / 5) * 5 % 360] for de in np.linspace(-6.5, 6.5, 7) for le in (-5, 0, 5)], axis=0) * 100
flat = blk((sl <= 8).astype(np.float32))   # fracción del bloque con pendiente apta a 120 m (límite del módulo HLS)
best = (flat >= .3) & (sun >= 50) & (ear >= 50)
li, si = dem.pixel(np.asarray(-85.98), np.asarray(-1.67)); mal = [float((li - h0) / B - .5), float((si - h0) / B - .5)]
out["relieve"] = {"n": N, "cell_m": cell, "h": [int(round(v)) for v in H.ravel()], "s": [int(round(v * 10)) for v in SL.ravel()],
                  "sun": [int(round(v)) for v in sun.ravel()], "best": [int(v) for v in best.ravel()], "malapert": mal}
mi, mj = int(round(mal[0])), int(round(mal[1]))
print("óptimas:", round(best.mean() * 100, 1), "% · Malapert", mal, "sol", round(sun[mi, mj]), "Tierra", round(ear[mi, mj]), "pend", round(SL[mi, mj], 1), "apto", round(flat[mi, mj], 2), "óptima", bool(best[mi, mj]),
      "| vecinos óptimos:", int(best[mi - 2:mi + 3, mj - 2:mj + 3].sum()))
open(f"{R}/src/capas.js", "w").write("window.ZENITH_CAPAS = " + json.dumps(out, separators=(",", ":")) + ";\n")
Image.open(f"{R}/../frontend/public/textures/ldem_3_8bit.jpg").convert("L").save(f"{R}/assets/lola.webp", quality=85, method=6)
print("capas.js", os.path.getsize(f"{R}/src/capas.js") // 1024, "KB · lola.webp", os.path.getsize(f"{R}/assets/lola.webp") // 1024, "KB", Image.open(f"{R}/assets/lola.webp").size)
