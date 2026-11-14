# Cómo selecciona la NASA los sitios de aterrizaje de Artemis

Revisión del 14-11-2026 sobre documentos primarios de la NASA. Complementa [regiones-artemis.md](regiones-artemis.md), que tiene los requisitos del HLS y los nombres de las regiones.

**En una línea:** la NASA no usa un puntaje estático por píxel. Filtra sitios por pendiente y peligros, y después los compara por **disponibilidad de misión**: con qué frecuencia, a lo largo del calendario, se cumplen a la vez todas las restricciones (lanzamiento, órbita, luz, comunicación, terreno). Los pesos de sus figuras de mérito no están publicados.

## El proceso (equipo CASSA)

La selección la hace el equipo *Cross Artemis Site Selection Analysis* (CASSA), con grupos de disponibilidad de misión, disponibilidad de sitio (HLS), descenso y aterrizaje, ciencia (SMD), tecnología (STMD), logística y datos lunares. La aprobación final es de la sede de la NASA ([Lawrence y George 2025, diapositiva 2](https://ntrs.nasa.gov/api/citations/20250008952/downloads/A4SiteSelectionWorkshopLSSW.pdf)).

| Paso | Qué hace |
|---|---|
| 1 | Definir los objetivos de la agencia que guían la selección (uso de recursos, logística, infraestructura) |
| 2 | Considerar las capacidades de cada elemento (HLS, trajes, vehículos, CLPS) |
| 3 | Determinar sitios con pendiente aceptable en zonas que cumplen los objetivos y las capacidades del vehículo |
| 4 | Análisis geoespacial |
| 5 | Aplicar **figuras de mérito ponderadas** para equilibrar los factores con la disponibilidad de misión |

Fuente: S. Lawrence y T. George, [*Artemis IV Landing Site Process Overview*](https://ntrs.nasa.gov/api/citations/20250008952/downloads/A4SiteSelectionWorkshopLSSW.pdf) (NASA JSC, 2025), diapositivas 2–5.

**Disponibilidad de misión** = frecuencia de oportunidades (días, ventanas y periodos de lanzamiento) en que la misión completa se puede hacer. Es un análisis iterativo que cambia con el diseño de los vehículos.

## Criterios del paso de 13 a 9 regiones (Artemis III)

Fuente principal: [T. George, M. A. Rubio, S. J. Lawrence y P. Curell, *Artemis III Site Selection Update: Down-selection from 13 to 9 Candidate Regions*, LPSC 2026, abstract 1901](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1901.pdf).

| Criterio | Qué dice la NASA | Umbral publicado |
|---|---|---|
| Evaluación conjunta | Lanzamiento, geometría de tránsito y encuentro (órbita NRHO), comunicación, desempeño de aterrizaje, iluminación y seguridad del terreno se evalúan **a la vez y por calendario** | — |
| Duración en superficie | Entre unos 5,75 y 6,25 días según la época, más vueltas en órbita baja | 5,75–6,25 días |
| Terreno | Minimizar la **variabilidad de la pendiente dentro de la elipse de aterrizaje**; priorizar regiones con **suficiente área de baja pendiente** | No publicado |
| Peligros | Cráteres de impacto, **poblaciones de bloques (rocas)** y terreno rugoso o muy variable; se prefieren regiones que permiten evitarlos eligiendo dónde aterrizar | No publicado |
| Comunicación | Si se usa comunicación directa con la Tierra, se prefieren regiones con **más visibilidad de la Tierra** | No publicado |
| Iluminación | Luz durante **toda** la estancia; la iluminación polar cambia por estación y se desplaza **2–3 semanas por año** en el calendario terrestre | Toda la estancia |
| Robustez | Se prefieren regiones robustas entre épocas de misión y poco sensibles a la estación | — |
| Varias regiones | Cada región ofrece pocas oportunidades viables cuando se exigen todas las restricciones; para tener disponibilidad anual aceptable **hacen falta varias regiones** | — |

El white paper [*Lunar Site Selection* (Architecture Workshop 2024)](https://www.nasa.gov/wp-content/uploads/2024/02/15-2024-architecture-workshop-white-paper-lunar-site-selection.pdf) agrega:

- **Luz:** el primer sitio debe tener luz durante unos 6–6,5 días.
- **Terreno:** relativamente plano, con bloques y cráteres pequeños dentro de la tolerancia del módulo.
- **Datos:** la disponibilidad y resolución de datos (las imágenes de ~1 m no cubren todo el polo) influye en la selección.
- **Comunicación:** sin red de relevo, la Tierra debe estar visible en el cielo del sitio.
- **Vida útil del HLS:** puede esperar en órbita unos 90 días; la tripulación debe llegar dentro de ese plazo.

## Otras referencias de la NASA

- **Lunar Surface Data Book** ([NASA/TP-20250002845, M2M-30044, 2025](https://ntrs.nasa.gov/api/citations/20250002845/downloads/M2M-30044%20Lunar%20Surface%20Data%20Book%20Baseline_Final.pdf)): catálogo de datos de superficie para planificación. Pendiente a 5 m al sur de 87° S, iluminación definida como "alguna fracción del disco solar visible" y guía para evaluar abundancia de rocas (documento DSNE, §3.4.1.4).
- **VIPER** ([Ennico-Smith et al. 2023](https://ntrs.nasa.gov/api/citations/20230004239/downloads/SSR2023-VIPER-Planning-Ennico.pdf); Shirley et al. 2022): planificación estratégica con DEM de 20 m y táctica con DEM de 1 m; "refugios seguros" con sombra de menos de 50 h; la batería aguanta 50 h en hibernación. La Tierra debe estar visible para operar.

## Estudio TOPSIS (Peña-Asensio et al., arXiv 2406.19863)

No es de la NASA, pero es la comparación más directa con nuestro método.

| Criterio | Qué mide |
|---|---|
| Filtro | Pendiente < 5° con margen de 100 m, DEM de 5 m, candidatos cada 50 m (1247 puntos en 14 regiones) |
| C1 | Área total visible desde 40 m de altura (ventanas del HLS), hasta 200 km |
| C2 | % del área caminable (radio de 2 km) desde donde se ve el módulo |
| C3 | Iluminación media × % de sombra permanente dentro de 2 km |
| C4 | Luz reflejada por la Tierra como indicador de comunicación directa |
| C5 | Número de unidades geológicas dentro de 2 km |
| C6 | Señal de minerales máficos (M3, banda de 1 µm) |

Pesos: iguales en la versión base; en la variante, 40 % a C3 y 40 % a C4. Ranking de los 20 mejores en su tabla 3.

## Qué implica para nuestro modelo

1. **La regla de diversidad tiene respaldo:** la NASA necesita varias regiones para tener disponibilidad anual.
2. **La etapa 2 debería medir disponibilidad, no un puntaje en una fecha:** fracción de fechas de aterrizaje posibles en que un candidato tiene luz continua durante toda la estancia y la Tierra visible. Se calcula con el motor actual.
3. **Falta terreno a escala de elipse:** "área de baja pendiente dentro de la elipse" se puede medir con la pendiente de PGDA; "bloques y cráteres" necesita datos que todavía no tenemos.
4. **Pesos:** la NASA usa figuras de mérito ponderadas, pero no publica los pesos. Pesos configurables con análisis de sensibilidad es coherente con su proceso.
5. **Lo que queda fuera de nuestro alcance:** lanzamiento, trayectoria y órbita NRHO. Nuestra disponibilidad sería solo la parte de superficie.

## No encontrado

- Pesos numéricos de las figuras de mérito.
- Umbral numérico de visibilidad de la Tierra y de variabilidad de pendiente.
- Lista de criterios del paso 5 para Artemis IV.
