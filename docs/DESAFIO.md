# Desafío: Evaluación rápida de sitios de aterrizaje en el polo sur lunar

## Resumen

Las misiones al polo sur de la Luna enfrentan condiciones extremas de iluminación y comunicación, y su planificación exige una coordinación estrecha entre los equipos de ciencia e ingeniería. Existen herramientas para determinar las posiciones del Sol y la Tierra en sitios de aterrizaje candidatos, pero sus interfaces complejas dificultan evaluar la información crítica con eficiencia.

**Tu reto:** crear una herramienta o aplicación intuitiva que permita a planificadores de misión, educadores y público general **comparar sitios y fechas de aterrizaje rápidamente**, visualizando la posición del Sol y la Tierra respecto al horizonte para evaluar:

- el potencial de **generación de energía**, y
- las **ventanas de comunicación directa con la Tierra**.

---

## Contexto

- El programa **CLPS** (Commercial Lunar Payload Services) de la NASA y otras misiones lunares dependen de elegir sitios y fechas de aterrizaje que equilibren las necesidades de ciencia e ingeniería.
- La posición del **Sol** determina la energía disponible para los paneles solares y las condiciones térmicas del equipo.
- La posición de la **Tierra** determina si es posible la comunicación directa sin satélites de relevo.
- En el **polo sur lunar** (donde hay hielo de agua y otros recursos valiosos) la geometría produce variaciones extremas de iluminación y visibilidad de la Tierra según el día y la estación lunar. Pequeños cambios de ubicación o fecha pueden alterar drásticamente la energía y las ventanas de comunicación.
- Los proyectos rara vez siguen un calendario fijo: retrasos de hardware o de lanzamiento obligan a reconsiderar fecha y lugar. Se necesita evaluar rápido **sitios alternativos en la misma región** o **fechas alternativas en el mismo sitio**.
- Herramientas existentes como **NASA Quickmap**, **Moon Trek** y **JPL Horizons System** están pensadas para análisis detallado y son difíciles de usar para comparar escenarios rápidamente. Evaluar cada combinación sitio-fecha implica navegar varias interfaces e interpretar datos en bruto.
- Falta una interfaz intuitiva que traduzca datos complejos de efemérides y topografía en **visualizaciones claras y comparables**.

---

## Objetivos

La solución puede incluir:

| Área | Descripción |
|---|---|
| **Selección y comparación interactiva de sitios** | Lista curada de sitios notables (Apolo, objetivos CLPS, misiones comerciales, programas de otros países) y entrada de **coordenadas lunares personalizadas**. Comparación lado a lado o secuencial de varios sitios para evaluar compromisos. |
| **Flexibilidad de fecha y hora** | Elegir fecha y hora de aterrizaje; explorar cómo cambian las condiciones a lo largo de distintos días y estaciones lunares y cómo afectan los cambios de calendario a la viabilidad. |
| **Visualización de posición del Sol y la Tierra** | Mostrar ambos astros respecto al horizonte en el sitio y fecha elegidos, incluyendo el **tiempo restante antes del ocaso solar o terrestre** (clave para operaciones y energía). |
| **Evaluación de energía y comunicación** | Métricas clave: **elevación solar** (eficiencia de generación), duración de luz solar y ventanas de visibilidad de la Tierra. Indicar rápidamente si una combinación sitio-fecha es viable. |
| **Múltiples enfoques de visualización** | Mapas 2D, superficies 3D u otras representaciones creativas de las relaciones espaciales entre sitio, Sol y Tierra. |
| **Dinámica temporal** | Animaciones o líneas de tiempo que muestren cómo cambian Sol y Tierra durante un día lunar o varios días, y la duración y momento de las ventanas operativas. |
| **Accesibilidad para distintos niveles** | Útil tanto para planificadores que requieren detalle técnico como para educadores y público curioso por los desafíos de ingeniería lunar. |

Se anima a la creatividad en el formato: aplicación web, app móvil, visualización interactiva, juego educativo u otro, siempre que haga **clara y eficiente** la evaluación rápida de sitios.

---

## Consideraciones potenciales (opcionales)

### Enfoque técnico

- **Efemérides** (posiciones y movimientos de cuerpos celestes): calculables con **JPL Horizons System** o con conjuntos de datos precalculados.
- **Topografía lunar** de fuentes como **LOLA** (Lunar Orbiter Laser Altimeter) para superficies realistas y cálculos precisos del horizonte.
- **Sin atmósfera:** no hay refracción; el horizonte lo determinan el terreno local y el borde de la esfera lunar visto desde el sitio.
- La **elevación solar** es la métrica clave de generación de energía: calcularla y mostrarla de forma destacada.

### Experiencia de usuario

- Priorizar la **comparación rápida de escenarios** (varias combinaciones sitio-fecha).
- Comunicar con claridad el **tiempo restante antes del ocaso solar o terrestre**.
- Hacer evidentes las **diferencias extremas** entre condiciones lunares y terrestres.
- Ayudar a entender por qué **pequeños cambios de lugar o fecha** tienen un gran impacto en la viabilidad.

### Datos y precisión

- Considerar la **topografía real** de la Luna: la elevación del terreno afecta el horizonte y las ventanas de visibilidad.
- Evaluar si se tendrá en cuenta la **libración** (oscilación aparente) y las **variaciones orbitales** de la Luna.
- El terreno del polo sur es complejo: pensar cómo representar **pendientes pronunciadas y cráteres profundos** que crean condiciones de sombra extremas.

### Compromiso e impacto

- Apoyar a los planificadores en la coordinación entre **ciencia e ingeniería**.
- Responder rápido ante **cambios de calendario o problemas de hardware** que obliguen a ajustar fecha o lugar.
- Servir como **herramienta educativa** para que estudiantes y público comprendan los retos de la exploración lunar y la complejidad de planificar misiones.

---

## Recursos

Los datos y recursos relacionados están en la pestaña **Resources** de la página del desafío (pueden añadirse más antes del hackathon).

Fuentes mencionadas: NASA Quickmap · Moon Trek · JPL Horizons System · LOLA (Lunar Orbiter Laser Altimeter).
