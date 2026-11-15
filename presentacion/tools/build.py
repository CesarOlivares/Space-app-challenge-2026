"""Construye dist/: index.html (deck con CSS/JS de la maqueta y SVG del kit en línea) + assets y gsap.
Con --offline genera además dist/zenith-pitch-offline.html (un solo archivo, todo en base64)."""
import base64, os, re, shutil, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UX = os.path.join(R, "..", "UX elements"); D = os.path.join(R, "dist")
rd = lambda p: open(os.path.join(R, p)).read()
s = rd("src/deck.html")
for tag, f in (("/*@@tokens.css*/", "src/tokens.css"), ("/*@@maqueta.css*/", "src/maqueta.css"), ("//@@datos.js", "src/datos.js"), ("//@@maqueta.js", "src/maqueta.js")):
    assert tag in s, tag; s = s.replace(tag, rd(f))
def svg(m):
    t = open(os.path.join(UX, m.group(2) + ".svg")).read()
    return m.group(1) + ">" + re.sub(r"<\?xml.*?\?>|<!--.*?-->", "", t, flags=re.S).strip()
s = re.sub(r'(<div [^>]*data-svg="([^"]+)"[^>]*)>', svg, s)
shutil.rmtree(D, ignore_errors=True); os.makedirs(os.path.join(D, "assets/fonts")); os.makedirs(os.path.join(D, "vendor"))
for f in os.listdir(os.path.join(R, "assets/fonts")): shutil.copy(os.path.join(R, "assets/fonts", f), os.path.join(D, "assets/fonts"))
for f in ("luna.webp", "luna-tex.webp"): shutil.copy(os.path.join(R, "assets", f), os.path.join(D, "assets"))
[shutil.copy(os.path.join(R, "vendor", f), os.path.join(D, "vendor")) for f in ("gsap.min.js", "qrcode.min.js")]
qr = rd("vendor/qrcode.min.js"); assert "</script" not in qr
s = s.replace('<script src="vendor/qrcode.min.js"></script>', "<script>" + qr + "</script>")  # en línea: 20 KB, evita bloqueos por nombre de archivo
open(os.path.join(D, "index.html"), "w").write(s)
if "--offline" in sys.argv:
    MIME = {".woff2": "font/woff2", ".webp": "image/webp"}
    def uri(m): return f"data:{MIME[os.path.splitext(m.group(0))[1]]};base64," + base64.b64encode(open(os.path.join(R, m.group(0)), "rb").read()).decode()
    off = re.sub(r"assets/[\w/.-]+\.(woff2|webp)", uri, s)
    for lib in ("gsap",):
        js = rd(f"vendor/{lib}.min.js"); assert "</script" not in js
        off = off.replace(f'<script src="vendor/{lib}.min.js"></script>', "<script>" + js + "</script>")
    open(os.path.join(D, "zenith-pitch-offline.html"), "w").write(off)
print("ok", sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(D) for f in fs) // 1024, "KB")
