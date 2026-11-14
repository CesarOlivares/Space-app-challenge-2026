import sys, json
import numpy as np, tifffile
from scipy.optimize import least_squares
from scipy.signal import find_peaks

def ajustar(path, paso_deg, n_anillos, dist_min):
    a = tifffile.imread(path).astype(int)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    cian = (G - R > 40) & (B - R > 40) & (abs(G - B) < 60)
    cy0, cx0 = cian.sum(axis=1).argmax(), cian.sum(axis=0).argmax()
    yy, xx = np.nonzero(cian)
    m = (abs(yy - cy0) > 3) & (abs(xx - cx0) > 3)
    yy, xx = yy[m], xx[m]
    d = np.hypot(yy - cy0, xx - cx0)
    h, e = np.histogram(d, bins=np.arange(0, 1300, 1))
    pk, _ = find_peaks(h, height=20, distance=dist_min)
    radios = e[pk][:n_anillos] + 0.5
    pts = [(k, yy[abs(d - r) < 3], xx[abs(d - r) < 3]) for k, r in enumerate(radios, start=1)]
    def res(p):
        cy, cx, K, D = p
        return np.concatenate([np.hypot(y - cy, x - cx) - K * np.sin(np.radians(k * paso_deg)) / (D - np.cos(np.radians(k * paso_deg))) for k, y, x in pts])
    sol = least_squares(res, [cy0, cx0, 2000.0, 1.3])
    rr = res(sol.x)
    return dict(zip(('cy', 'cx', 'K', 'D'), map(float, sol.x)), paso_deg=paso_deg, radios=radios.tolist(),
                rms_px=float(np.sqrt(np.mean(rr ** 2))), max_px=float(np.abs(rr).max()))

def a_pixel(g, lat, lon):
    c = np.radians(90 + np.asarray(lat, float))
    r = g['K'] * np.sin(c) / (g['D'] - np.cos(c))
    lam = np.radians(lon)
    return g['cy'] - r * np.cos(lam), g['cx'] + r * np.sin(lam)

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    nombre, path, paso, n, dmin = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    g = ajustar(path, paso, n, dmin)
    json.dump(g, open(f'georef_{nombre}.json', 'w'), indent=1)
    print(nombre, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in g.items() if k != 'radios'})
    for nom, la, lo in (('Shackleton', -89.67, 129.78), ('Amundsen', -84.5, 82.8), ('Malapert', -85.99, 358.33), ('Haworth', -87.45, 355.6)):
        f, c = a_pixel(g, la, lo)
        print(f'  {nom}: fila {f:.0f}, col {c:.0f}')
