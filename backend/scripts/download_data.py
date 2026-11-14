"""Descarga los datos externos que no se guardan en git.

Uso: ./run.sh data   (o: python scripts/download_data.py [--force])

Es idempotente: omite los archivos que ya existen con el tamaño esperado.
"""

import argparse
import shutil
import sys
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
    (f"{SVS}/ldem_3_8bit.jpg", TEXTURES / "ldem_3_8bit.jpg", 111552),
    # Three.js local para no depender de un CDN en tiempo de ejecución (RNF-07).
    (f"{THREE}/build/three.module.js", VENDOR / "three" / "three.module.js", 1314681),
    (f"{THREE}/examples/jsm/controls/OrbitControls.js",
     VENDOR / "three" / "addons" / "controls" / "OrbitControls.js", 32134),
]


# Opcional (--dem): solo hace falta para recalcular máscaras de horizonte o para
# calcular el horizonte por terreno de coordenadas personalizadas del polo sur.
DEM_FILES = [
    (f"{LOLA}/ldem_75s_120m.lbl", DEM / "ldem_75s_120m.lbl", 4991),
    (f"{LOLA}/ldem_75s_120m.img", DEM / "ldem_75s_120m.img", 116250752),
]


def download(url: str, dest: Path, size: int, force: bool) -> None:
    if not force and dest.exists() and dest.stat().st_size == size:
        print(f"  ok      {dest.relative_to(ROOT)}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"  bajando {dest.relative_to(ROOT)} ({size / 1e6:.1f} MB)")
    with urllib.request.urlopen(url, timeout=300) as response, open(tmp, "wb") as out:
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="volver a descargar todo")
    parser.add_argument("--dem", action="store_true", help="incluir el DEM polar LOLA (116 MB)")
    args = parser.parse_args()

    for url, dest, size in FILES + (DEM_FILES if args.dem else []):
        download(url, dest, size, args.force)
    convert_texture(args.force)
    print("Datos listos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
