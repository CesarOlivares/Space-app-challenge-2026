import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tifffile

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
DATOS = AQUI.parent / 'datos'
SVS = DATOS / 'svs'
sys.path.insert(0, str(REPO / 'backend'))
from app.models.ephemeris import Ephemeris  # noqa: E402
from app.models.horizon import TerrainHorizon  # noqa: E402
from app.models.site import Site  # noqa: E402
from app.models.terrain import PolarDEM, compute_mask  # noqa: E402

INICIO = datetime(2027, 1, 1, tzinfo=timezone.utc)
RADIO_SOL_DEG = 0.267
UMBRALES = (10, 20, 35)


def sitios():
    lista = []
    cat = json.load(open(REPO / 'backend' / 'data' / 'sites.json', encoding='utf-8'))
    cat = cat if isinstance(cat, list) else cat.get('sites', [])
    for s in cat:
        if s['lat'] <= -80.0:
            lista.append(('catalogo', s['id'], s['lat'], s['lon']))
    for nombre, la, lo in (('glaser-C1', -89.4398, 222.83), ('glaser-C2', -89.3130, 245.98),
                           ('glaser-S', -89.6866, 197.19), ('glaser-S2', -89.7815, 204.70)):
        lista.append(('glaser', nombre, la, lo))
    for s in json.load(open(DATOS / 'wueller_sitios.json', encoding='utf-8')):
        lista.append(('wueller-' + s['Landing_Re'], s['Name'], s['Latitude'], s['Longitude']))
    return lista


def pixel_5027(g, lat, lon):
    c = np.radians(90 + lat)
    r = g['K'] * np.sin(c) / (g['D'] - np.cos(c))
    lam = np.radians(lon)
    return g['cy'] - r * np.cos(lam), g['cx'] + r * np.sin(lam)


def pixel_4930(g, lat, lon):
    r = (90 + lat) / 2.0 * g['r2deg']
    lam = np.radians(lon)
    return g['cy'] - r * np.cos(lam), g['cx'] + r * np.sin(lam)


def brillo(frame, f, c):
    fi, ci = int(round(f)), int(round(c))
    if not (2 <= fi < frame.shape[0] - 2 and 2 <= ci < frame.shape[1] - 2):
        return np.nan
    v = frame[fi - 1:fi + 2, ci - 1:ci + 2].reshape(-1, 3).astype(int)
    r, g, b = v[:, 0], v[:, 1], v[:, 2]
    superpuesto = (((g - r > 25) & (b - r > 25)) | ((r - g > 40) & (r - b > 40))
                   | ((r > 200) & (g > 200) & (b > 200) & (abs(r - g) < 8)))
    validos = v[~superpuesto]
    if len(validos) < 3:
        return np.nan
    return float(np.median(validos.max(axis=1)))


def serie_svs(carpeta, prefijo, georef, a_pixel, puntos):
    dias, valores = [], []
    pix = [a_pixel(georef, la, lo) for _, _, la, lo in puntos]
    for arch in sorted((SVS / carpeta).glob(f'{prefijo}.*.tif')):
        try:
            fr = tifffile.imread(arch)
        except Exception:
            continue
        dias.append((int(arch.stem.split('.')[-1]) - 1) / 12.0)
        valores.append([brillo(fr, f, c) for f, c in pix])
    return np.array(dias), np.array(valores)


def serie_motor(puntos, dias):
    dem = PolarDEM.open(REPO / 'backend' / 'data' / 'dem')
    eph = Ephemeris(REPO / 'backend' / 'data' / 'kernels')
    horas = np.round(np.asarray(dias) * 24).astype(int)
    holguras = []
    for _, nombre, la, lo in puntos:
        hz = TerrainHorizon(compute_mask(dem, la, lo))
        tr = eph.track(Site(id=nombre, name=nombre, lat=la, lon=lo), 'sun', INICIO, float(horas.max()), 1.0)
        holguras.append(hz.clearance(tr.azimuth[horas], tr.elevation[horas]))
    return np.array(holguras).T


def comparar(nombre_sim, puntos, dias, brillos, holg):
    valido = ~np.isnan(brillos)
    disco = holg > -RADIO_SOL_DEG
    res = {'simulacion': nombre_sim, 'cuadros': int(len(dias)), 'por_umbral': {}, 'sitios': []}
    for u in UMBRALES:
        luz = brillos > u
        res['por_umbral'][u] = {
            'acuerdo_centro': round(float((luz == (holg > 0))[valido].mean()), 4),
            'acuerdo_disco': round(float((luz == disco)[valido].mean()), 4),
            'motor_luz_svs_sombra': round(float((disco & ~luz)[valido].mean()), 4),
            'motor_sombra_svs_luz': round(float((~disco & luz)[valido].mean()), 4),
            'acuerdo_disco_holgura_mayor_1': round(float((luz == disco)[valido & (abs(holg) > 1)].mean()), 4),
        }
    for j, (grupo, nombre, la, lo) in enumerate(puntos):
        v = valido[:, j]
        if v.sum() < 10:
            continue
        luz = brillos[v, j] > 20
        res['sitios'].append({'grupo': grupo, 'sitio': nombre, 'lat': la, 'lon': lo, 'n': int(v.sum()),
                              'luz_svs': round(float(luz.mean()), 3),
                              'luz_motor_disco': round(float(disco[v, j].mean()), 3),
                              'luz_motor_centro': round(float((holg[v, j] > 0).mean()), 3),
                              'acuerdo_disco': round(float((luz == disco[v, j]).mean()), 3)})
    return res


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    puntos = sitios()
    g5 = json.load(open(AQUI / 'georef_5027.json'))
    g4 = json.load(open(AQUI / 'georef_4930.json'))
    salida = {}
    for nombre_sim, carpeta, prefijo, g, fpix, filtro in (
            ('SVS 5027 (sur de 80° S)', '5027', 'moon', g5, pixel_5027, lambda la: la <= -80.0),
            ('SVS 4930 (sur de 88° S)', '4930', 'sp_illum', g4, pixel_4930, lambda la: la <= -88.05)):
        sub = [p for p in puntos if filtro(p[2])]
        dias, brillos = serie_svs(carpeta, prefijo, g, fpix, sub)
        r = comparar(nombre_sim, sub, dias, brillos, serie_motor(sub, dias))
        salida[carpeta] = r
        print(nombre_sim, 'cuadros', r['cuadros'], 'sitios', len(r['sitios']), r['por_umbral'][20])
    json.dump(salida, open(AQUI / 'resultados_svs.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
