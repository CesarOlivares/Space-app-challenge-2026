import sys
import urllib.request
from pathlib import Path

BASE = 'https://svs.gsfc.nasa.gov/vis/a000000'
SIMULACIONES = {
    '5027': (f'{BASE}/a005000/a005027/frames/1920x1080_16x9_30p/2027', 'moon'),
    '4930': (f'{BASE}/a004900/a004930/frames/1920x1080_16x9_30p/2027', 'sp_illum'),
}
CUADROS_DIARIOS = range(1, 4381, 12)


def main(destino):
    for nombre, (url, prefijo) in SIMULACIONES.items():
        carpeta = Path(destino) / 'svs' / nombre
        carpeta.mkdir(parents=True, exist_ok=True)
        for n in CUADROS_DIARIOS:
            archivo = carpeta / f'{prefijo}.{n:04d}.tif'
            if archivo.exists():
                continue
            parcial = archivo.with_suffix('.part')
            urllib.request.urlretrieve(f'{url}/{prefijo}.{n:04d}.tif', parcial)
            parcial.rename(archivo)
        print(nombre, 'listo')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'datos')
