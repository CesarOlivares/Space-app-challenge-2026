import sys
import urllib.request
from pathlib import Path

ARCHIVOS = {
    'AVGVISIB_75S_120M_201608.IMG': 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.IMG',
    'AVGVISIB_75S_120M_201608.LBL': 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608.LBL',
    'AVGVISIB_75S_120M_201608_EARTH.IMG': 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.IMG',
    'AVGVISIB_75S_120M_201608_EARTH.LBL': 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_75S_120M_201608_EARTH.LBL',
    'pgda90/LPSR_80S_20MPP_ADJ.TIF': 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LPSR_80S_20MPP_ADJ.TIF',
    'pgda90/LDRM_80S_50MPP_ADJ_SLP_100M.TIF': 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDRM_80S_50MPP_ADJ_SLP_100M.TIF',
    'pgda90/LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF': 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF',
    'Landing_Sites.zip': 'https://zenodo.org/records/17084058/files/Landing_Sites.zip?download=1',
}
FIRMAS = {'.TIF': (b'II*\x00', b'II+\x00', b'MM\x00*', b'MM\x00+'), '.zip': (b'PK',)}


def main(destino):
    destino = Path(destino)
    for nombre, url in ARCHIVOS.items():
        ruta = destino / nombre
        if ruta.exists():
            print('ya está', nombre)
            continue
        ruta.parent.mkdir(parents=True, exist_ok=True)
        print('descargando', nombre)
        parcial = ruta.with_suffix(ruta.suffix + '.part')
        urllib.request.urlretrieve(url, parcial)
        firma = FIRMAS.get(ruta.suffix)
        if firma and not parcial.read_bytes()[:4].startswith(firma):
            parcial.unlink()
            raise SystemExit(f'{nombre}: la respuesta no es el archivo esperado (PGDA a veces devuelve HTML con código 200)')
        parcial.rename(ruta)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'datos')
