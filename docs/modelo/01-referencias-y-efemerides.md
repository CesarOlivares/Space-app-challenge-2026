# 01 · Sistemas de referencia y efemérides

## Implementado

### Coordenadas de los sitios

- Marco **Mean Earth/Polar Axis (ME)**, el mismo que usan LROC, LOLA y JPL Horizons.
- Latitud $\varphi$ planetocéntrica, positiva al norte. Longitud $\lambda$ positiva al este, en $[-180°, 180°]$.
- La Luna se modela como una **esfera de radio $R = 1737{,}4$ km** (radio de referencia de LOLA y de Horizons).

### Efemérides

Se usan los kernels SPICE del JPL (NAIF), leídos con la biblioteca Skyfield:

| Kernel | Contenido |
|---|---|
| `de440s.bsp` | Posiciones del Sol, la Tierra y la Luna (DE440, versión 1849–2150) |
| `moon_pa_de440_200625.bpc` | Orientación de la Luna en el marco de ejes principales (PA), integrada junto con DE440 |
| `moon_de440_250416.tf` | Definición de los marcos lunares y la rotación fija PA → ME |
| `pck00011.tpc` | Constantes planetarias |

El marco usado es `MOON_ME_DE440_ME421`: marco ME definido a partir de la orientación DE440, alineado con la convención de DE421 que usan los productos de LRO.

Como la orientación de la Luna viene de la integración numérica de DE440, el modelo **incluye la libración física y las variaciones orbitales reales** sin tratarlas aparte.

**Detalle de implementación.** El kernel `.bpc` trae dos segmentos (1550–2426 y 2426–2650) y Skyfield se queda con el último que lee, lo que daba error con fechas actuales. Se fuerza el segmento que contiene J2000.

### Tiempo

Fechas en UTC. Skyfield convierte a TDB con su tabla interna de segundos intercalares.

## Pendiente de respaldar

- [ ] Cita formal de DE440 (Park et al., 2021) y de la nota técnica del marco ME/PA de NAIF.
- [ ] Explicar en una frase la diferencia entre los marcos PA y ME y por qué los mapas de LRO usan ME.
- [ ] Confirmar que el catálogo `sites.json` está todo en ME: LROC publica en ME, pero algunas fuentes secundarias podrían no estarlo.
