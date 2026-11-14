# 03 · Horizonte

Sin atmósfera, el horizonte lo fijan el terreno y la curvatura de la esfera. Un cuerpo es visible si su elevación supera la del horizonte en su azimut, más un margen opcional:

$$
c(t) = h(t) - \big(H(A(t)) + m\big), \qquad \text{visible} \iff c(t) > 0
$$

$c$ es la **holgura** (*clearance*), $H(A)$ la elevación del horizonte en el azimut $A$ y $m$ el margen configurable, por ejemplo para despejar una antena.

## Implementado

### Horizonte esférico

$H(A) = 0°$ en todas direcciones. Se usa para los sitios sin datos de relieve: todos los que están al norte de 80° S.

### Horizonte por terreno (LOLA)

Para los sitios al sur de 80° S, $H(A)$ sale del modelo de elevación **LOLA `LDEM_75S_120M`**: estereográfica polar sur, 120 m por píxel, de 75° S al polo, con alturas en metros sobre la esfera de 1737,4 km.

**Proyección** (de la etiqueta PDS del producto; índices desde 0):

$$
\rho = 2R\tan\!\left(\tfrac{\pi}{4} + \tfrac{\varphi}{2}\right), \qquad
\text{columna} = 3811{,}5 + \frac{\rho\sin\lambda}{120\ \text{m}}, \qquad
\text{línea} = 3811{,}5 - \frac{\rho\cos\lambda}{120\ \text{m}}
$$

La altura es $0{,}5 \times$ el valor guardado (enteros de 16 bits), con interpolación bilineal entre píxeles.

**Recorrido.** Para cada azimut $A$ (cada 0,5°) y cada distancia $d$ (de 120 m a 150 km, cada 120 m) se calcula el punto destino sobre la esfera, con $\delta = d/R$:

$$
\varphi_2 = \arcsin(\sin\varphi\cos\delta + \cos\varphi\sin\delta\cos A)
$$
$$
\lambda_2 = \lambda + \operatorname{atan2}(\sin A\sin\delta\cos\varphi,\ \cos\delta - \sin\varphi\sin\varphi_2)
$$

**Ángulo de elevación del relieve**, exacto sobre la esfera. El observador está a radio $r_0 = R + z(\text{sitio}) + 2\ \text{m}$ y el relieve a $r_1 = R + z(d)$:

$$
\alpha(A, d) = \operatorname{atan2}\big(r_1\cos\delta - r_0,\ r_1\sin\delta\big), \qquad H(A) = \max_d\ \alpha(A, d)
$$

**Parámetros:**

| Parámetro | Valor | Origen |
|---|---|---|
| Paso de azimut | 0,5° | Supuesto del equipo |
| Radio de búsqueda | 150 km | Supuesto del equipo |
| Paso de distancia | 120 m (un píxel) | Resolución del DEM |
| Altura del observador | 2 m | Supuesto del equipo: paneles o antena de un módulo típico |
| Cobertura | $\varphi \le -75° - \frac{150\ \text{km}}{R} \approx -79{,}95°$ | Borde del DEM menos el radio de búsqueda |

Las máscaras de los sitios del catálogo están precalculadas en `backend/data/horizons/`. Para coordenadas personalizadas se calculan al vuelo si el DEM está descargado.

## Pendiente de respaldar

- [ ] Justificar los 150 km: estimar el mayor ángulo que puede aportar relieve más lejano, considerando la caída por curvatura $\approx d/(2R)$ en radianes.
- [ ] Justificar los 2 m de altura del observador con módulos reales (IM-2, VIPER, Blue Ghost).
- [ ] Comparar la máscara de al menos un sitio con una fuente externa, por ejemplo las simulaciones de iluminación de QuickMap o estudios publicados de Shackleton o Malapert (Mazarico et al., 2011; Bussey et al.).
- [ ] Cita del producto LOLA (Smith et al., 2010; ficha PDS de `LDEM_75S_120M`).
- [ ] Evaluar si conviene un DEM de mayor resolución (20 m o 5 m) cerca del sitio y el de 120 m para el relieve lejano.
