# 05 · Puntaje y viabilidad

Los criterios de esta página son **decisiones del equipo**, no física. Por eso es donde más fuentes y justificación hacen falta.

## Implementado

Para un sitio y una fecha de aterrizaje $t_0$, con ventana de misión $T_w$ (por defecto 14 días):

### Viabilidad

$$
\text{viable} \iff \text{Sol visible en } t_0 \ \land\ \text{Tierra visible en } t_0 \ \land\ T_c \ge T_s \ \land\ \text{pendiente} \le \theta_{\max}
$$

Visible significa holgura positiva, con relieve y margen incluidos (ver [03 · Horizonte](03-horizonte.md)).

- **Luz durante toda la estancia** ($T_c \ge T_s$): las horas continuas de luz desde el aterrizaje deben cubrir la estancia $T_s$ = 6,5 días (`stay_days`; se recorta a la ventana). La NASA pide Sol durante toda la estancia del HLS y las 13 regiones de 2022 tienen sitios con 6,5 días de luz continua ([regiones-artemis.md](investigacion/regiones-artemis.md)). La API lo expone como `sun_through_stay`.
- **Pendiente** $\le \theta_{\max}$ = 8° por defecto (`max_slope_deg`), solo si hay dato (ver [Terreno](#terreno-t)); sin dato no cambia el veredicto. El 8° es el filtro de terreno de Wueller et al. y coincide con el umbral de **orientación** del HLS (HLS-R-0071); no es una especificación de pendiente del terreno del HLS. Nuestra pendiente sale de un DEM de 120 m (base de ~360 m), más suave que a escala del módulo: con el mismo umbral el veredicto es **optimista**.

### Energía

$$
E = 100\left(0{,}5\,U + 0{,}5\,\min\!\left(1, \frac{T_c}{T_w}\right)\right)
$$

- $T_c$: **horas continuas de luz desde el aterrizaje**. Vale 0 si el Sol no es visible en $t_0$, $T_w$ si no se pone durante la ventana, y el tiempo hasta el ocaso en los demás casos.
- $U$: **aprovechamiento solar**, según la orientación de los paneles (parámetro `panel`):

| `panel` | $U$ | Idea |
|---|---|---|
| `tiempo` (por defecto) | Fracción de $T_w$ con Sol visible | Solo cuenta horas de luz, sin importar la altura del Sol |
| `horizontal` | $\overline{\sin h \cdot [\text{visible}]}$ | Paneles planos: la irradiancia es proporcional al seno de la elevación |
| `vertical` | $\overline{\cos h \cdot [\text{visible}]}$ | Paneles verticales que giran en azimut hacia el Sol, típicos de módulos polares |

La barra indica el promedio sobre las muestras. $h$ se recorta a $[0°, 90°]$ y $[\text{visible}]$ vale 1 si el Sol es visible y 0 si no.

### Comunicación

$$
C = 100 \times \left( 0{,}5 \cdot \text{fracción de } T_w \text{ con la Tierra visible} + 0{,}5 \cdot \min\!\left(1, \frac{\text{horas de contacto continuo desde } t_0}{\text{horas de } T_w}\right) \right)
$$

Misma forma que la energía: la segunda mitad premia no perder el enlace justo después de aterrizar.

La Tierra cuenta como visible con su centro al menos $m_T = 2°$ sobre el horizonte (`earth_margin_deg`, ajustable en la interfaz). Es el margen de antena con el que las tres estaciones DSN de 34 m quedan visibles desde la superficie (NASA/TM-20220013310 §5.8.3, págs. 74–75) y además cubre el disco completo de la Tierra (~0,95° de radio).

**Por qué la comunicación se comporta distinto que la luz.** La Luna muestra siempre la misma cara, así que desde el polo la Tierra no recorre el horizonte como el Sol: queda en un azimut casi fijo (±8°) y su elevación oscila ~±7° con la libración, en un ciclo de ~27 días. La ventana de 14 días cubre media oscilación, por eso la fecha de aterrizaje cambia tanto el resultado, y solo importa el relieve en un sector de ~20° del horizonte. Medido con el modelo para 2027:

| Sitio | Azimut de la Tierra | Elevación | Visible (centro) | Visible ($m_T = 2°$) |
|---|---|---|---|---|
| im-1 | 352° ± 8° | 2,7° a 16,3° | 100 % | 100 % |
| mons-malapert | 7° ± 8° | −3,1° a 10,6° | 100 % | 78 % |
| im-2 | 331° ± 8° | −2,3° a 10,8° | 80 % | 67 % |
| mons-mouton | 329° ± 8° | −2,2° a 10,8° | 56 % | 46 % |
| change-7 | 237° ± 8° | −7,6° a 5,8° | 56 % | 46 % |
| shackleton-ridge | 163° ± 8° | −7,4° a 6,3° | 45 % | 35 % |

im-2 y mons-mouton están casi en el mismo lugar y con la misma geometría; el relieve los separa en 24 puntos.

**Lado de la Tierra.** No limita: en 2027 la Luna está a más de 10° sobre al menos uno de los tres complejos DSN (Goldstone, Madrid, Canberra) el 98 % del tiempo, con cortes de 1,5 h como máximo. Es igual para todos los sitios, así que no entra al puntaje.

### Terreno (T)

La elevación, pendiente y rugosidad se obtienen de datos medidos por el altímetro láser LOLA de la misión LRO:
1. **Polo Sur ($\varphi \le -75^\circ$ S):** Sale del DEM polar `LDEM_75S_120M` (120 m por píxel): se ajusta un plano por mínimos cuadrados a la ventana de $3 \times 3$ píxeles (~360 m de base) alrededor del sitio (`terrain.py`), obteniendo `source: "lola_dem"`.
2. **Global ($\varphi > -75^\circ$ S):** Proviene del **LOLA Global DEM** (`LDEM_16`, 16 píxeles por grado, ~1,89 km/píxel en el ecuador, NASA PDS / SVS), calculando la pendiente por diferencias finitas centradas sobre el geoide lunar y la rugosidad RMS local (`source: "lola_global"`).
3. **Sin DEM disponible:** Si los archivos DEM no están en el servidor, `source = "unavailable"`, la elevación se toma del catálogo (`elevation_m`, fuente LROC) y pendiente/rugosidad quedan en `null`.

| Métrica | Qué mide | Qué no mide |
|---|---|---|
| Pendiente | Inclinación media del plano a la escala de la grilla (120 m o ~1,9 km) | La micro-pendiente bajo las patas del tren de aterrizaje (escala métrica) |
| Rugosidad | Desviación estándar RMS del relieve respecto del plano local | Rocas individuales o bloques menores a la celda |

$T$ (*landing ease*) combina 65 % pendiente, 25 % rugosidad y 10 % de azimuts con horizonte bajo 18°. Esas constantes son **supuestos del equipo**: por eso $T$ pesa 0 por defecto y se muestra como información técnica.

### Puntaje global

$$
P = \frac{w_E\,E + w_C\,C + w_T\,T}{w_E + w_C + w_T}
$$

Por defecto $w_E = w_C = 0{,}5$ y $w_T = 0$, así que $P = (E + C)/2$: lo que pide el desafío y lo que está validado contra Horizons. La NASA usa figuras de mérito ponderadas pero **no publica los pesos**, así que cualquier reparto es una decisión del equipo; por eso los pesos son configurables y la interfaz muestra siempre los que se usaron. El criterio exploratorio de protección contra impactos ($A$) fue eliminado del sistema por falta de sustento en la literatura oficial y ausencia de datos relevantes.

Un término sin dato (`null`) se excluye junto con su peso. Cuando un criterio **con peso > 0** falta en un sitio, la API lo lista en `missing_criteria`: su $P$ se calcula con menos criterios y **no es comparable** con el de un sitio que los tiene todos. La comparación lo avisa y marca el total como parcial. Con la integración del Global DEM, el criterio de terreno $T$ está disponible para todos los sitios del catálogo.

Un sitio no viable (Sol o Tierra no visibles al aterrizar, sol que no cubre la estancia de 6,5 días, o pendiente medida sobre el límite) conserva su P, pero la interfaz lo presenta como **referencial** y la comparación no lo declara ganador.

### Efecto del relieve

Ejemplo real del modelo para un aterrizaje el 15/12/2026: en IM-2 el Sol está a +2,2°, pero el relieve lo tapa, así que el sitio no es viable con terreno y sí lo sería con horizonte esférico. Ese día, tres de los seis sitios polares cambian de veredicto al considerar el relieve con el margen de 2° para la Tierra (cinco con margen 0°).

### Disponibilidad

`GET /api/sites/{ref}/availability` evalúa una fecha de aterrizaje cada `step_hours` (24 h por defecto) durante `days` (365) y devuelve cuáles cumplen todos los requisitos y cuál falla en las demás ("sun": sin luz al aterrizar o que no dura la estancia; "earth": sin Tierra al aterrizar; "slope": pendiente sobre el límite). Es la parte de superficie de la **disponibilidad de misión** de la NASA (CASSA): lanzamiento, trayectoria y órbita no se modelan. Máximo 400 fechas por consulta.

Ejemplo del 20-11-2026: Mons Malapert cumple en el 15 % de las fechas del año (casi todas las fallas son por luz) e IM-2 en el 18 %; coincide con lo que dice la NASA de que cada región ofrece pocas oportunidades.

### Sensibilidad a los pesos

La comparación prueba 2.000 combinaciones de pesos al azar (distribución de Dirichlet uniforme, semilla fija) y cuenta en cuántas gana cada sitio viable. Usa solo los criterios con dato en **todos** los sitios comparados y se calcula en el navegador con los puntajes recibidos. Sirve porque los pesos de la NASA no se publican: si el ganador cambia con los pesos, la conclusión es frágil. Los umbrales de la frase ("no depende", "depende en parte", "no hay ganador claro") son 90 % y 60 %, orientativos.

## Supuestos del equipo, pendientes de respaldar

- [x] **Límite de pendiente.** Resuelto el 14-11-2026: el valor por defecto pasó de 15° a 8° (Wueller et al.; Peña-Asensio usan ≤ 5°). Los 8°/5° del HLS (HLS-R-0071) son inclinación del **vehículo**, no pendiente del terreno. Con 8° sobre el DEM 3 × 3, IM-1 (11,8°), Mons Mouton (9,4°) y Shackleton (10,2°) pasan a no viables. Pendiente: medirla a escala de la elipse de aterrizaje (100 m, 3σ) en vez de 360 m.
- [x] **Constantes de T y eliminación de A.** Resuelto el 15-11-2026: el criterio experimental de protección A fue eliminado del modelo y la arquitectura se simplificó a los 3 pilares clave (E, C, T). $w_T = 0$ por defecto para mantener consistencia con los requisitos principales.

- [ ] **Ventana de 14 días.** ¿Corresponde a la duración típica de misiones CLPS (IM-1, IM-2 y Blue Ghost duraron días a ~2 semanas)? Citar las duraciones planificadas.
- [ ] **50 % aprovechamiento + 50 % continuidad.** Justificar por qué importa la continuidad (baterías, supervivencia a la noche lunar) o proponer otro reparto.
- [ ] **Pesos 50/50 entre energía y comunicación.** ¿Hay literatura de selección de sitios con criterios ponderados? (p. ej. estudios de sitios Artemis III con decisión multicriterio).
- [ ] **Modelo de paneles.** Confirmar con diseños reales: VIPER, Intuitive Machines y Firefly usan paneles verticales o mixtos.
- [ ] **Sol como punto.** Con el Sol a pocos grados del horizonte, que asome medio disco (radio ~0,27°) ya da algo de energía. Evaluar contar la visibilidad por el limbo superior.
- [x] **Tierra como punto.** Resuelto: centro a 2° sobre el horizonte (margen de antena de NASA/TM-20220013310 §5.8.3), que cubre el disco completo. Visibilidad a largo plazo validada contra el mapa oficial de PGDA (ver [06 · Validación](06-validacion.md)).
- [x] **Viabilidad solo en $t_0$.** Resuelto parcialmente el 14-11-2026: ahora exige además luz continua durante la estancia de 6,5 días. Falta decidir si la **Tierra** también debe cubrir la estancia (hoy solo se exige en $t_0$) y fijar una duración de estancia por tipo de misión (6,5 días es la del HLS tripulado; las CLPS duran distinto).
- [ ] **Irradiancia constante.** No se considera la variación de la distancia Tierra-Sol (~±3,4 %) ni la temperatura. Documentar si es despreciable para el objetivo de la herramienta.
