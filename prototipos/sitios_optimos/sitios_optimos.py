import json
import sys
from pathlib import Path
import numpy as np
import tifffile
import zarr
from scipy import ndimage

R = 1737400.0
PX = 120.0
C = 3811.5
N = 7624
AQUI = Path(__file__).resolve().parent
DATOS = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / 'datos'
DEM = AQUI.parents[1] / 'backend' / 'data' / 'dem' / 'ldem_75s_120m.img'
SOL = DATOS / 'AVGVISIB_75S_120M_201608.IMG'
TIERRA = DATOS / 'AVGVISIB_75S_120M_201608_EARTH.IMG'
PSR_TIF = DATOS / 'pgda90' / 'LPSR_80S_20MPP_ADJ.TIF'
SLP_TIF = DATOS / 'pgda90' / 'LDRM_80S_50MPP_ADJ_SLP_100M.TIF'
RUG_TIF = DATOS / 'pgda90' / 'LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF'
SITIOS = DATOS / 'wueller_sitios.json'
RESULTADOS = AQUI / 'resultados'

PENDIENTE_MAX = 8.0
LAT_LIMITE = -83.0
PSR_DECAE_KM = 10.0
SEPARACION_KM = 2.0
RADIO_REGION_KM = 7.5


def a_pixel(lat, lon):
    rho = 2 * R * np.tan(np.pi / 4 + np.radians(lat) / 2)
    lam = np.radians(lon)
    return C - rho * np.cos(lam) / PX, C + rho * np.sin(lam) / PX


def leer(path, escala):
    return np.fromfile(path, dtype='<i2').reshape(N, N).astype(np.float32) * escala


def georef(path):
    with tifffile.TiffFile(str(path)) as tf:
        p = tf.pages[0]
        sx, sy = p.tags['ModelPixelScaleTag'].value[:2]
        tp = p.tags['ModelTiepointTag'].value
        gk = p.tags['GeoKeyDirectoryTag'].value
        punto = any(gk[i] == 1025 and gk[i + 3] == 2 for i in range(4, len(gk), 4))
        nodata = p.tags['GDAL_NODATA'].value if 'GDAL_NODATA' in p.tags else None
        x0, y0 = tp[3] - tp[0] * sx, tp[4] + tp[1] * sy
        if punto:
            x0, y0 = x0 - sx / 2, y0 + sy / 2
        return dict(x0=x0, y0=y0, sx=sx, sy=sy, shape=p.shape, dtype=p.dtype, nodata=nodata)


def abrir(path):
    return zarr.open(tifffile.imread(str(path), aszarr=True, level=0), mode='r')


rho_lim = 2 * R * np.tan(np.pi / 4 + np.radians(-80.0) / 2) / PX
lo, hi = int(C - rho_lim) - 2, int(C + rho_lim) + 3
recorte = (slice(lo, hi), slice(lo, hi))
idx = np.arange(lo, hi)
xc = (idx - C) * PX
yc = (C - idx) * PX

z = leer(DEM, 0.5)[recorte]
sol = leer(SOL, 0.00004)[recorte]
tierra = leer(TIERRA, 0.00004)[recorte]
filas, cols = np.meshgrid(idx, idx, indexing='ij')
rho = np.hypot((cols - C) * PX, (C - filas) * PX)
lat = np.degrees(2 * np.arctan(rho / (2 * R)) - np.pi / 2).astype(np.float32)
del filas, cols, rho

gy, gx = np.gradient(z, PX)
pend_120 = np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32)
del gx, gy, z


def muestrear(path):
    g = georef(path)
    a = abrir(path)
    fil = np.floor((g['y0'] - yc) / g['sy']).astype(int)
    col = np.floor((xc - g['x0']) / g['sx']).astype(int)
    ok_f = (fil >= 0) & (fil < g['shape'][0])
    ok_c = (col >= 0) & (col < g['shape'][1])
    out = np.full((idx.size, idx.size), np.nan, np.float32)
    bloque = 256
    cf = np.nonzero(ok_c)[0]
    for i in range(0, idx.size, bloque):
        rf = np.arange(i, min(i + bloque, idx.size))
        rf = rf[ok_f[rf]]
        if rf.size == 0:
            continue
        f0, f1 = fil[rf].min(), fil[rf].max() + 1
        trozo = np.asarray(a[f0:f1, :])
        vals = trozo[np.ix_(fil[rf] - f0, col[cf])].astype(np.float32)
        if g['nodata'] is not None:
            vals[vals == float(g['nodata'])] = np.nan
        out[np.ix_(rf, cf)] = vals
    return out, g


def psr_por_celda(path):
    g = georef(path)
    a = abrir(path)
    paso = int(round(PX / g['sx']))
    borde_x = xc - PX / 2
    borde_y = yc + PX / 2
    c0 = np.round((borde_x - g['x0']) / g['sx']).astype(int)
    f0 = np.round((g['y0'] - borde_y) / g['sy']).astype(int)
    out = np.zeros((idx.size, idx.size), bool)
    ok_c = (c0 >= 0) & (c0 + paso <= g['shape'][1])
    cs = np.nonzero(ok_c)[0]
    cmin, cmax = c0[cs].min(), c0[cs].max() + paso
    validas = (f0 >= 0) & (f0 + paso <= g['shape'][0])
    for i0 in range(0, idx.size, 512):
        filas_bloque = [k for k in range(i0, min(i0 + 512, idx.size)) if validas[k]]
        if not filas_bloque:
            continue
        base = f0[filas_bloque].min()
        trozo = np.asarray(a[base:f0[filas_bloque].max() + paso, cmin:cmax])
        if g['nodata'] is not None:
            trozo = np.where(trozo == g['nodata'], 0, trozo)
        for i in filas_bloque:
            anyc = (trozo[f0[i] - base:f0[i] - base + paso] != 0).any(axis=0)
            out[i, cs] = np.add.reduceat(anyc.astype(np.int32), c0[cs] - cmin)[:cs.size] > 0
    return out, g


pend_100, g_slp = muestrear(SLP_TIF)
rug_100, g_rug = muestrear(RUG_TIF)
psr_of, g_psr = psr_por_celda(PSR_TIF)
print('georef pendiente', {k: g_slp[k] for k in ('x0', 'y0', 'sx', 'shape', 'dtype', 'nodata')})
print('georef sombra', {k: g_psr[k] for k in ('x0', 'y0', 'sx', 'shape', 'dtype', 'nodata')})

psr_aprox = sol <= 0.0
f_sh, c_sh = a_pixel(-89.67, 129.78)
control = {'fondo_shackleton_psr_oficial': bool(psr_of[int(round(f_sh)) - lo, int(round(c_sh)) - lo]),
           'acuerdo_psr_oficial_vs_aprox_en_80S': {
               'oficial_y_aprox': int((psr_of & psr_aprox & (lat <= -80)).sum()),
               'solo_oficial': int((psr_of & ~psr_aprox & (lat <= -80)).sum()),
               'solo_aprox': int((~psr_of & psr_aprox & (lat <= -80)).sum())}}

sitios = json.load(open(SITIOS, encoding='utf-8'))
sf, sc = a_pixel(np.array([s['Latitude'] for s in sitios]), np.array([s['Longitude'] for s in sitios]))
sfi, sci = np.round(sf).astype(int) - lo, np.round(sc).astype(int) - lo
regiones = np.array([s['Landing_Re'] for s in sitios])
r_px = RADIO_REGION_KM * 1000 / PX
marca = np.ones_like(sol, bool)
marca[sfi, sci] = False
dist_sitio = ndimage.distance_transform_edt(marca)
control['pendiente_100m_en_sitios'] = {'mediana': round(float(np.nanmedian(pend_100[sfi, sci])), 2),
                                       'max': round(float(np.nanmax(pend_100[sfi, sci])), 2),
                                       'sitios_le_8': int(np.sum(pend_100[sfi, sci] <= 8))}
control['pendiente_120m_en_sitios'] = {'mediana': round(float(np.median(pend_120[sfi, sci])), 2),
                                       'max': round(float(np.max(pend_120[sfi, sci])), 2)}
control['rugosidad_100m_en_sitios_m'] = {'mediana': round(float(np.nanmedian(rug_100[sfi, sci])), 3)}
zona = lat <= LAT_LIMITE
control['rugosidad_100m_zona_m'] = {'p50': round(float(np.nanpercentile(rug_100[zona], 50)), 3),
                                    'p90': round(float(np.nanpercentile(rug_100[zona], 90)), 3)}
print(json.dumps(control, ensure_ascii=False, indent=1))

tam = int(round(SEPARACION_KM * 1000 / PX)) | 1


def rango(v, m):
    vv = np.where(m & np.isfinite(v), v, np.nan)
    orden = np.sort(vv[np.isfinite(vv)])
    return np.where(np.isfinite(vv), np.searchsorted(orden, vv) / max(orden.size, 1), np.nan)


def diverso(cand, d_km):
    if d_km <= 0:
        return cand
    d2, elegidos = (d_km * 1000 / PX) ** 2, []
    for c in cand:
        if all((c[0] - e[0]) ** 2 + (c[1] - e[1]) ** 2 >= d2 for e in elegidos):
            elegidos.append(c)
    return elegidos


def correr(nombre, pend, psr_dist_mask, usar_rug):
    d_psr = ndimage.distance_transform_edt(~psr_dist_mask) * PX / 1000.0
    psr_score = np.clip(1 - d_psr / PSR_DECAE_KM, 0, 1)
    partes = [sol, tierra, psr_score]
    if usar_rug:
        partes.append(1 - np.nan_to_num(rango(rug_100, zona), nan=1.0))
    S = sum(partes) / len(partes)
    factible = zona & (np.nan_to_num(pend, nan=99) <= PENDIENTE_MAX) & ~psr_aprox
    S_f = np.where(factible, S, -1.0)
    maximos = (S_f == ndimage.maximum_filter(S_f, size=tam)) & factible
    fi, ci = np.nonzero(maximos)
    orden = np.argsort(-S_f[fi, ci])
    base = [(int(fi[k]), int(ci[k]), float(S_f[fi[k], ci[k]])) for k in orden]
    ordenado = np.sort(S[zona])
    pct = np.searchsorted(ordenado, S[sfi, sci]) / ordenado.size * 100
    res = {'variante': nombre, 'sitios_factibles': int(factible[sfi, sci].sum()),
           'percentil_mediano_sitios': round(float(np.median(pct)), 1),
           'sitios_en_top10%': round(float(np.mean(pct >= 90)), 3),
           'linea_base_aleatoria': round(float(np.mean(dist_sitio[factible] <= r_px)), 3)}
    for div in (0.0, 15.0):
        cand = diverso(base, div)
        for n in (50, 100):
            cf = np.array([c[0] for c in cand[:n]])
            cc = np.array([c[1] for c in cand[:n]])
            dd = np.hypot(cf[:, None] - sfi[None, :], cc[:, None] - sci[None, :])
            cerca = dd.min(axis=1) <= r_px
            reg = sorted(set(regiones[dd.argmin(axis=1)][cerca]))
            res[f'div{int(div)}_top{n}'] = {'cerca': round(float(cerca.mean()), 3), 'regiones': len(reg)}
        if div == 15.0:
            res['_cand'] = cand[:100]
    return res, S_f


variantes = [('A: v2 (pendiente 120 m, sombra aproximada)', pend_120, psr_aprox, False),
             ('B: pendiente 100 m de PGDA', pend_100, psr_aprox, False),
             ('C: B + sombra permanente oficial', pend_100, psr_of, False),
             ('D: C + rugosidad 100 m', pend_100, psr_of, True)]
salida = []
for nombre, pend, psrm, rug in variantes:
    r, S_f = correr(nombre, pend, psrm, rug)
    cand = r.pop('_cand')
    salida.append(r)
    print(json.dumps(r, ensure_ascii=False))
    if nombre.startswith('D'):
        np.savez_compressed(DATOS / 'capas.npz', S=S_f.astype(np.float32), lat=lat, lo=lo, sitios_f=sfi, sitios_c=sci,
                            cand=np.array(cand) + [lo, lo, 0])
        top = [{'lat': round(float(lat[c[0], c[1]]), 3),
                'lon_este': round(float(np.degrees(np.arctan2(c[1] + lo - C, C - c[0] - lo)) % 360), 2),
                'S': round(c[2], 3), 'sol': round(float(sol[c[0], c[1]]), 3), 'tierra': round(float(tierra[c[0], c[1]]), 3),
                'pendiente_100m': round(float(pend_100[c[0], c[1]]), 1), 'rugosidad_100m_m': round(float(rug_100[c[0], c[1]]), 2),
                'region_artemis_cercana': str(regiones[np.argmin(np.hypot(sfi - c[0], sci - c[1]))]),
                'dist_sitio_artemis_km': round(float(np.min(np.hypot(sfi - c[0], sci - c[1])) * PX / 1000), 1)}
               for c in cand[:20]]
json.dump({'control': control, 'variantes': salida, 'top20_D_diversos': top},
          open(RESULTADOS / 'resultados.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
