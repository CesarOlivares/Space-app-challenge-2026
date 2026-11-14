import sys
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use('Agg')
import matplotlib.pyplot as plt

AQUI = Path(__file__).resolve().parent
DATOS = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / 'datos'
LAT_LIMITE = -83.0

d = np.load(DATOS / 'capas.npz')
S, lat, lo = d['S'], d['lat'], int(d['lo'])
sf, sc, cand = d['sitios_f'], d['sitios_c'], d['cand']

filas = np.nonzero((lat <= LAT_LIMITE).any(axis=1))[0]
r0, r1 = filas.min(), filas.max() + 1
paso = 3
fondo = np.where(lat[r0:r1:paso, r0:r1:paso] <= LAT_LIMITE, 0.15, np.nan)
img = np.where(S >= 0, S, np.nan)[r0:r1:paso, r0:r1:paso]

fig, ax = plt.subplots(figsize=(9, 9), dpi=110)
ax.imshow(fondo, cmap='Greys', vmin=0, vmax=1)
im = ax.imshow(img, cmap='viridis', vmin=0.3, vmax=0.87)
ax.scatter((sc - r0) / paso, (sf - r0) / paso, s=26, facecolors='none', edgecolors='#ff00ff', linewidths=1.3,
           label='Sitios Artemis (Wueller et al. 2026)')
ax.scatter((cand[:50, 1] - lo - r0) / paso, (cand[:50, 0] - lo - r0) / paso, s=24, marker='x', c='red', linewidths=1.3,
           label='50 mejores candidatos (diversidad 15 km)')
ax.set_title('Aptitud: iluminación + Tierra + cercanía a sombra permanente + rugosidad, pendiente ≤ 8° sobre 100 m\n'
             f'Polo sur lunar al sur de {abs(LAT_LIMITE):.0f}° S, capas PGDA', fontsize=9.5)
ax.set_xticks([])
ax.set_yticks([])
ax.text(0.5, 0.995, 'lado visible (lon 0°) ↑', transform=ax.transAxes, ha='center', va='top', fontsize=8)
ax.legend(loc='lower left', fontsize=8, framealpha=0.85)
fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02, label='Puntaje S (gris = descartado)')
fig.tight_layout()
fig.savefig(AQUI / 'resultados' / 'mapa.png')
