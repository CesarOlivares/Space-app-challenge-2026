"""Extrae de las respuestas grabadas del backend real los datos que usa la maqueta del pitch -> src/datos.js
y prepara la textura liviana del globo. Uso: backend/.venv/bin/python presentacion/tools/extraer_datos.py"""
import json, os
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(f"{R}/src/app-demo/fixtures.js").read()
fx = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
get = lambda pre: next(v for k, v in fx.items() if k.startswith(pre))
sites = get("/api/sites?")["sites"]
out = {"sitios": {x["id"]: {"nombre": x["name"], "lat": x["lat"], "lon": x["lon"], "cat": x["category"]} for x in sites}, "fechas": {}, "ficha": {}, "comparar": {}}
for d in ("2026-11-18", "2026-11-23", "2026-11-24"):
    sc = get(f"/api/scores?date={d}")["scores"]
    out["fechas"][d] = {r["site_id"]: {"v": r["viable"], "t": round(r["scores"]["total"]), "e": round(r["scores"]["energy"]), "c": round(r["scores"]["communication"])} for r in sc}
for d in ("2026-11-23", "2026-11-24"):
    k = next(k for k in fx if f"mons-malapert/sky?date={d}" in k); a = fx[k]
    out["ficha"][d] = {"viable": a["viable"], "sunSetH": round(a["sun"]["hours_until_set"] or 0, 1), "sunSet": a["sun"]["set_time"],
        "earthSetH": a["earth"]["hours_until_set"], "earthSet": a["earth"]["set_time"], "earthRise": a["earth"]["rise_time"],
        "earthRiseH": a["earth"]["hours_until_rise"],
        "total": round(a["scores"]["total"]), "energy": round(a["scores"]["energy"]), "comm": round(a["scores"]["communication"]),
        "sunFrac": a["sun"]["visible_fraction"], "earthFrac": a["earth"]["visible_fraction"], "slope": a["topography"]["slope_deg"]}
for r in get("/api/compare")["results"]:
    t, sun, ea = r["topography"], r["sun"], r["earth"]
    out["comparar"][r["site_id"]] = {"viable": r["viable"], "total": r["scores"]["total"], "energy": r["scores"]["energy"], "comm": r["scores"]["communication"],
        "terrain": r["scores"]["terrain"], "slope": t["slope_deg"], "sunHours": sun["visible_hours"], "sunSetH": sun["hours_until_set"], "earthFrac": ea["visible_fraction"], "earthHours": ea["visible_hours"]}
open(f"{R}/src/datos.js", "w").write("window.ZENITH_DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
im = Image.open(f"{R}/../frontend/public/textures/moon_color_4k.jpg").convert("RGB").resize((2048, 1024), Image.LANCZOS)
im.save(f"{R}/assets/luna-tex.webp", quality=72, method=6)
print("datos.js", os.path.getsize(f"{R}/src/datos.js") // 1024, "KB · luna-tex.webp", os.path.getsize(f"{R}/assets/luna-tex.webp") // 1024, "KB")
print(json.dumps(out["ficha"], ensure_ascii=False, indent=1)); print(json.dumps(out["comparar"], ensure_ascii=False, indent=1)[:1200])
