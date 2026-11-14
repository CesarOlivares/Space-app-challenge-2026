# 02 · Posición del Sol y la Tierra desde la superficie

## Implementado

### Base local del sitio

Para un sitio en $(\varphi, \lambda)$, en el marco ME:

$$
\hat{u} = (\cos\varphi\cos\lambda,\ \cos\varphi\sin\lambda,\ \sin\varphi) \qquad
\hat{e} = (-\sin\lambda,\ \cos\lambda,\ 0) \qquad
\hat{n} = \hat{u} \times \hat{e}
$$

$\hat{u}$ es la vertical local (cenit), $\hat{e}$ el este y $\hat{n}$ el norte.

### Vector hacia el cuerpo

Sea $M(t)$ la matriz de rotación ICRF → ME en el instante $t$, $\vec{r}_L$ la posición del centro de la Luna y $\vec{r}_B$ la del cuerpo (Sol o Tierra), ambas en ICRF. La posición del sitio en ICRF es $\vec{r}_L + M^\top R\,\hat{u}$, y la dirección hacia el cuerpo en el marco ME es:

$$
\vec{v} = M(t)\,\big(\vec{r}_B - \vec{r}_L - M(t)^\top R\,\hat{u}\big), \qquad \hat{v} = \vec{v}/\lVert\vec{v}\rVert
$$

### Azimut y elevación

$$
h = \arcsin(\hat{u}\cdot\hat{v}) \qquad A = \operatorname{atan2}(\hat{e}\cdot\hat{v},\ \hat{n}\cdot\hat{v}) \bmod 360°
$$

El azimut $A$ se mide desde el norte hacia el este, igual que en Horizons. No hay refracción porque la Luna no tiene atmósfera.

### Puntos subsolar y subterrestre

El punto de la Luna que tiene al cuerpo en el cenit sale de la dirección desde el centro lunar:

$$
\hat{d} = \frac{M(t)(\vec{r}_B - \vec{r}_L)}{\lVert\cdot\rVert}, \qquad \varphi_s = \arcsin d_z, \quad \lambda_s = \operatorname{atan2}(d_y, d_x)
$$

El punto subsolar ubica el terminador en el globo. El subterrestre muestra la libración y orienta la "vista desde la Tierra".

### Aproximaciones

| Aproximación | Efecto | Por qué se acepta |
|---|---|---|
| Posiciones geométricas, sin tiempo de luz ni aberración | < 0,01° frente a Horizons | La tolerancia acordada (RNF-03) es 0,5° |
| Sitio sobre la esfera de 1737,4 km, sin su altura | Paralaje de la Tierra < 0,001° por km de altura | Despreciable frente a la tolerancia |
| Sol y Tierra como puntos, usando su centro | Ver [05 · Puntaje](05-puntaje.md) | Pendiente de evaluar |

## Pendiente de respaldar

- [ ] Referencia para las fórmulas de la base topocéntrica ENU (cualquier texto de astrodinámica sirve; p. ej. Vallado).
- [ ] Cuantificar el efecto de ignorar el tamaño aparente del Sol (radio de ~0,27°) y de la Tierra (radio de ~0,95° vista desde la Luna) en la visibilidad.
