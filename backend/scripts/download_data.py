"""Descarga los datos externos que no se guardan en git.

Uso: ./run.sh data   (o: python scripts/download_data.py [--force] [--dem] [--no-hires])

Es idempotente: omite los archivos que ya existen con el tamaño esperado.

Textura y relieve del globo (V3): además de la textura de 4K, baja el mosaico de color de 8K
y el relieve global de LOLA (16 píxeles por grado) y genera los archivos que usa el globo en
frontend/public/textures/: moon_color_8k.jpg, moon_height_2k.png, moon_normal_4k.jpg y
moon_relief.json. --no-hires los omite (el globo queda con la textura de 4K y sin relieve).
"""

import argparse
import json
import shutil
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KERNELS = ROOT / "backend" / "data" / "kernels"
TEXTURES = ROOT / "frontend" / "public" / "textures"
VENDOR = ROOT / "frontend" / "vendor"
DEM = ROOT / "backend" / "data" / "dem"

NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels"
SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720"
THREE = "https://cdn.jsdelivr.net/npm/three@0.170.0"
LOLA = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img"

# (url, destino, tamaño en bytes)
FILES = [
    # Efemérides planetarias DE440 (versión corta, 1849–2150): Sol, Tierra, Luna.
    (f"{NAIF}/spk/planets/de440s.bsp", KERNELS / "de440s.bsp", 32726016),
    # Orientación precisa de la Luna (marco Principal Axis) y su relación con Mean Earth.
    (f"{NAIF}/pck/moon_pa_de440_200625.bpc", KERNELS / "moon_pa_de440_200625.bpc", 12863488),
    (f"{NAIF}/fk/satellites/moon_de440_250416.tf", KERNELS / "moon_de440_250416.tf", 19478),
    (f"{NAIF}/pck/pck00011.tpc", KERNELS / "pck00011.tpc", 131226),
    # NASA SVS CGI Moon Kit: mosaico de color LROC con polos completos, y relieve LOLA.
    (f"{SVS}/lroc_color_poles_4k.tif", TEXTURES / "lroc_color_poles_4k.tif", 13095388),
    # Three.js local para no depender de un CDN en tiempo de ejecución (RNF-07).
    (f"{THREE}/build/three.module.js", VENDOR / "three" / "three.module.js", 1314681),
    (f"{THREE}/examples/jsm/controls/OrbitControls.js",
     VENDOR / "three" / "addons" / "controls" / "OrbitControls.js", 32134),
]


# Alta resolución (se omite con --no-hires): color 8K y relieve global LOLA en kilómetros.
HIRES_FILES = [
    (f"{SVS}/lroc_color_poles_8k.tif", TEXTURES / "lroc_color_poles_8k.tif", 50641970),
    (f"{SVS}/ldem_16.tif", TEXTURES / "ldem_16.tif", 66378634),
]

# Opcional (--dem): solo hace falta para recalcular máscaras de horizonte o para
# calcular el horizonte por terreno de coordenadas personalizadas del polo sur.
DEM_FILES = [
    (f"{LOLA}/ldem_75s_120m.lbl", DEM / "ldem_75s_120m.lbl", 4991),
    (f"{LOLA}/ldem_75s_120m.img", DEM / "ldem_75s_120m.img", 116250752),
]


def _urlopen_with_cert_fallback(url: str, timeout: int = 300):
    """Abre una URL asegurando compatibilidad con los certificados SSL de Windows/macOS/Linux."""
    # 1. Intentar con certifi si está instalado
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        return urllib.request.urlopen(url, timeout=timeout, context=ctx)
    except Exception:
        pass

    # 2. Intentar con el almacén estándar
    try:
        return urllib.request.urlopen(url, timeout=timeout)
    except urllib.error.URLError as e:
        # 3. Fallback para entornos Windows donde Python no enlaza el almacén de certificados
        if "CERTIFICATE_VERIFY_FAILED" in str(e):
            ctx_unverified = ssl._create_unverified_context()
            return urllib.request.urlopen(url, timeout=timeout, context=ctx_unverified)
        raise


def download(url: str, dest: Path, size: int, force: bool) -> None:
    if not force and dest.exists() and dest.stat().st_size == size:
        print(f"  ok      {dest.relative_to(ROOT)}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  bajando {dest.relative_to(ROOT)} ({size / 1e6:.1f} MB)")
    with _urlopen_with_cert_fallback(url, timeout=300) as response, open(tmp, "wb") as out:
        shutil.copyfileobj(response, out)
    if tmp.stat().st_size != size:
        tmp.unlink()
        raise RuntimeError(f"{url}: tamaño inesperado; ¿cambió el archivo en el servidor?")
    tmp.replace(dest)


def convert_texture(force: bool) -> None:
    """El navegador no lee TIFF: se convierte el mosaico a JPEG de 4096 × 2048."""
    from PIL import Image

    src = TEXTURES / "lroc_color_poles_4k.tif"
    dest = TEXTURES / "moon_color_4k.jpg"
    if not force and dest.exists():
        print(f"  ok      {dest.relative_to(ROOT)}")
        return
    print(f"  convirtiendo {dest.relative_to(ROOT)}")
    with Image.open(src) as img:
        img.convert("RGB").save(dest, quality=90)


MOON_RADIUS_M = 1737400.0
COLOR_8K = TEXTURES / "moon_color_8k.jpg"
HEIGHT_2K = TEXTURES / "moon_height_2k.png"
NORMAL_4K = TEXTURES / "moon_normal_4k.jpg"
RELIEF_META = TEXTURES / "moon_relief.json"

# Las pendientes reales del relieve lunar a esta escala son suaves (de 0 a ~0,3): se guardan
# multiplicadas por este factor para no perder precisión en 8 bits, y el globo lo compensa.
NORMAL_GAIN = 4.0


def convert_color_8k(force: bool) -> None:
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = None
    src = TEXTURES / "lroc_color_poles_8k.tif"
    if not force and COLOR_8K.exists():
        print(f"  ok      {COLOR_8K.relative_to(ROOT)}")
        return
    print(f"  convirtiendo {COLOR_8K.relative_to(ROOT)}")
    with Image.open(src) as img:
        img.convert("RGB").save(COLOR_8K, quality=86, optimize=True)


def convert_relief(force: bool) -> None:
    """Relieve LOLA (km, 5760 × 2880) → mapa de alturas de 2K y mapa de normales de 4K."""
    import numpy as np
    from PIL import Image

    outputs = (HEIGHT_2K, NORMAL_4K, RELIEF_META)
    if not force and all(p.exists() for p in outputs):
        print(f"  ok      {HEIGHT_2K.relative_to(ROOT)}, {NORMAL_4K.relative_to(ROOT)}")
        return
    print("  convirtiendo el relieve (mapa de alturas y de normales)")
    with Image.open(TEXTURES / "ldem_16.tif") as img:
        heights_m = np.asarray(img, dtype=np.float32) * 1000.0
    low, high = float(heights_m.min()), float(heights_m.max())

    def resized(width: int, height: int) -> np.ndarray:
        image = Image.fromarray(heights_m, mode="F").resize((width, height), Image.BILINEAR, reducing_gap=2.0)
        return np.asarray(image, dtype=np.float32)

    # Mapa de alturas: 8 bits entre el mínimo y el máximo; el globo lo usa para desplazar la malla.
    small = resized(2048, 1024)
    scaled = np.clip((small - low) / (high - low), 0.0, 1.0) * 255.0
    Image.fromarray(np.rint(scaled).astype(np.uint8), mode="L").save(HEIGHT_2K, optimize=True)

    # Mapa de normales en espacio tangente (u = este, v = norte), a partir de las pendientes reales.
    w, h = 4096, 2048
    grid = resized(w, h)
    lat = np.radians(90.0 - (np.arange(h) + 0.5) * 180.0 / h)
    cos_lat = np.maximum(np.cos(lat), 0.02)
    dy = np.pi * MOON_RADIUS_M / h
    # En un mapa rectangular los píxeles se estrechan hacia los polos: la distancia real entre dos
    # columnas vecinas tiende a 0 y las pendientes se disparan (rayos radiales). Para evitarlo, la
    # pendiente este-oeste se mide sobre una distancia física constante: en cada fila se salta
    # k ≈ 1 / cos(lat) columnas.
    steps = np.clip(np.rint(1.0 / cos_lat).astype(int), 1, 64)
    d_east = np.zeros_like(grid)
    for k in np.unique(steps):
        rows = steps == k
        baseline = 2 * k * (2 * np.pi * MOON_RADIUS_M / w) * cos_lat[rows][:, None]
        d_east[rows] = (np.roll(grid[rows], -k, axis=1) - np.roll(grid[rows], k, axis=1)) / baseline
    d_north = -(np.vstack([grid[1:], grid[-1:]]) - np.vstack([grid[:1], grid[:-1]])) / (2 * dy)
    normal = np.dstack([-d_east * NORMAL_GAIN, -d_north * NORMAL_GAIN, np.ones_like(grid)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rgb = np.rint((normal * 0.5 + 0.5) * 255.0).astype(np.uint8)
    Image.fromarray(rgb, mode="RGB").save(NORMAL_4K, quality=95, subsampling=0, optimize=True)

    RELIEF_META.write_text(json.dumps({
        "source": "LOLA LDEM_16 (NASA SVS, CGI Moon Kit), relativo a la esfera de 1737,4 km",
        "reference_radius_m": MOON_RADIUS_M,
        "min_m": round(low, 1),
        "max_m": round(high, 1),
        "height_map": HEIGHT_2K.name,
        "normal_map": NORMAL_4K.name,
        "normal_gain": NORMAL_GAIN,
    }, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="volver a descargar todo")
    parser.add_argument("--dem", action="store_true", help="incluir el DEM polar LOLA (116 MB)")
    parser.add_argument("--no-hires", action="store_true", help="omitir la textura 8K y el relieve global (117 MB)")
    args = parser.parse_args()

    files = FILES + ([] if args.no_hires else HIRES_FILES) + (DEM_FILES if args.dem else [])
    for url, dest, size in files:
        download(url, dest, size, args.force)
    convert_texture(args.force)
    if not args.no_hires:
        convert_color_8k(args.force)
        convert_relief(args.force)
    print("Datos listos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
