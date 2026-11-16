"""Construye dist/: index.html (deck) y explainer.html (animación de 30 s en inglés), con CSS/JS de la maqueta y SVG del kit en línea, + assets y gsap.
Con --offline genera además versiones de un solo archivo (todo en base64)."""
import base64, os, re, shutil, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UX = os.path.join(R, "..", "UX elements"); D = os.path.join(R, "dist")
rd = lambda p: open(os.path.join(R, p)).read()
def svg(m):
    t = open(os.path.join(UX, m.group(2) + ".svg")).read()
    return m.group(1) + ">" + re.sub(r"<\?xml.*?\?>|<!--.*?-->", "", t, flags=re.S).strip()
def armar(src):
    s = rd(src)
    for tag, f in (("/*@@tokens.css*/", "src/tokens.css"), ("/*@@maqueta.css*/", "src/maqueta.css"), ("//@@datos.js", "src/datos.js"), ("//@@maqueta.js", "src/maqueta.js")):
        assert tag in s, tag; s = s.replace(tag, rd(f))
    s = s.replace("//@@capas.js", rd("src/capas.js"))  # solo el explicativo usa las capas
    s = re.sub(r'(<div [^>]*data-svg="([^"]+)"[^>]*)>', svg, s)
    qr = rd("vendor/qrcode.min.js"); assert "</script" not in qr
    return s.replace('<script src="vendor/qrcode.min.js"></script>', "<script>" + qr + "</script>")  # en línea: 20 KB, evita bloqueos por nombre de archivo
def offline(s):
    MIME = {".woff2": "font/woff2", ".webp": "image/webp"}
    def uri(m): return f"data:{MIME[os.path.splitext(m.group(0))[1]]};base64," + base64.b64encode(open(os.path.join(R, m.group(0)), "rb").read()).decode()
    off = re.sub(r"assets/[\w/.-]+\.(woff2|webp)", uri, s)
    js = rd("vendor/gsap.min.js"); assert "</script" not in js
    return off.replace('<script src="vendor/gsap.min.js"></script>', "<script>" + js + "</script>")
shutil.rmtree(D, ignore_errors=True); os.makedirs(os.path.join(D, "assets/fonts")); os.makedirs(os.path.join(D, "vendor"))
for f in os.listdir(os.path.join(R, "assets/fonts")): shutil.copy(os.path.join(R, "assets/fonts", f), os.path.join(D, "assets/fonts"))
for f in ("luna.webp", "luna-tex.webp", "lola.webp"): shutil.copy(os.path.join(R, "assets", f), os.path.join(D, "assets"))
[shutil.copy(os.path.join(R, "vendor", f), os.path.join(D, "vendor")) for f in ("gsap.min.js", "qrcode.min.js")]
# deck del pitch (español) y animación explicativa de 30 s (inglés)
for src, out, off in (("src/deck.html", "index.html", "zenith-pitch-offline.html"), ("src/explainer.html", "explainer.html", "zenith-explainer-offline.html")):
    s = armar(src); open(os.path.join(D, out), "w").write(s)
    if "--offline" in sys.argv: open(os.path.join(D, off), "w").write(offline(s))
print("ok", sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(D) for f in fs) // 1024, "KB")
