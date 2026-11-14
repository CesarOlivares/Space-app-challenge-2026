import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
REPO = AQUI.parents[2]
PGDA = AQUI.parent / 'datos'
sys.path.insert(0, str(REPO / 'backend'))
sys.path.insert(0, str(AQUI))
from app.models.ephemeris import Ephemeris  # noqa: E402
from app.models.horizon import TerrainHorizon  # noqa: E402
from app.models.site import Site  # noqa: E402
from app.models.terrain import PolarDEM, compute_mask  # noqa: E402

import validar_svs  # noqa: E402

R = 1737400.0
C = 3811.5
N = 7624
INICIO = datetime(2010, 1, 1, tzinfo=timezone.utc)
DURACION_H = 18.6 * 365.25 * 24
PASO_H = 3.0
RADIO = {'earth': 0.95, 'sun': 0.267}
CAPA = {'earth': 'AVGVISIB_75S_120M_201608_EARTH.IMG', 'sun': 'AVGVISIB_75S_120M_201608.IMG'}


def puntos():
    lista = [p for p in validar_svs.sitios() if p[2] <= -80.0]
    rng = np.random.default_rng(2026)
    for i in range(200):
        lista.append(('azar', f'azar-{i:03d}', float(rng.uniform(-89.8, -80.2)), float(rng.uniform(0, 360))))
    return lista


def valor_pgda(capa, lat, lon):
    rho = 2 * R * np.tan(np.pi / 4 + np.radians(lat) / 2)
    f = int(round(C - rho * np.cos(np.radians(lon)) / 120.0))
    c = int(round(C + rho * np.sin(np.radians(lon)) / 120.0))
    return float(capa[f, c]) * 0.00004


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    capas = {k: np.fromfile(PGDA / v, dtype='<i2').reshape(N, N) for k, v in CAPA.items()}
    dem = PolarDEM.open(REPO / 'backend' / 'data' / 'dem')
    eph = Ephemeris(REPO / 'backend' / 'data' / 'kernels')
    filas = []
    for grupo, nombre, la, lo in puntos():
        sitio = Site(id=nombre, name=nombre, lat=la, lon=lo)
        mascaras = {h: TerrainHorizon(compute_mask(dem, la, lo, observer_height_m=h)) for h in (0.0, 2.0)}
        fila = {'grupo': grupo.split('-')[0], 'sitio': nombre, 'lat': la, 'lon': lo}
        for cuerpo in ('earth', 'sun'):
            tr = eph.track(sitio, cuerpo, INICIO, DURACION_H, PASO_H)
            for h, hz in mascaras.items():
                fila[f'{cuerpo}_motor_{int(h)}m'] = float(np.mean(hz.clearance(tr.azimuth, tr.elevation) > -RADIO[cuerpo]))
            fila[f'{cuerpo}_pgda'] = valor_pgda(capas[cuerpo], la, lo)
        filas.append(fila)
    resumen = {}
    for cuerpo in ('earth', 'sun'):
        p = np.array([f[f'{cuerpo}_pgda'] for f in filas])
        for h in (0, 2):
            d = np.array([f[f'{cuerpo}_motor_{h}m'] for f in filas]) - p
            resumen[f'{cuerpo}_{h}m'] = {
                'n': len(p), 'correlacion': round(float(np.corrcoef(d + p, p)[0, 1]), 4),
                'sesgo_medio_pts': round(float(d.mean() * 100), 2), 'error_abs_medio_pts': round(float(abs(d).mean() * 100), 2),
                'p90_error_abs_pts': round(float(np.percentile(abs(d), 90) * 100), 2),
                'dentro_de_5_pts': round(float(np.mean(abs(d) <= 0.05)), 3)}
    json.dump({'resumen': resumen, 'puntos': filas}, open(AQUI / 'resultados_tierra_pgda.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(json.dumps(resumen, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
