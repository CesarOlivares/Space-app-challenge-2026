# Referencias

## Datos usados por la aplicación

| Fuente | Uso | Enlace |
|---|---|---|
| JPL Horizons | Validación de posiciones del Sol y la Tierra | https://ssd.jpl.nasa.gov/horizons/ |
| NAIF generic kernels (DE440, orientación lunar) | Efemérides | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ |
| LOLA `LDEM_75S_120M` (PDS Geosciences) | Relieve del polo sur y horizontes | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ |
| NASA SVS CGI Moon Kit | Textura de color LROC (4K y 8K) y relieve global LOLA de 16 píxeles por grado, en km sobre la esfera de 1737,4 km | https://svs.gsfc.nasa.gov/4720/ |
| LROC — Coordinates of Lunar Anthropogenic Features (2016) | Coordenadas de Apolo, Luna, Surveyor y Chang'e 3 | https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf |
| Páginas de imágenes de LROC y NASA | Coordenadas de módulos recientes | Ver `source` de cada sitio en `backend/data/sites.json` |
| USGS Gazetteer of Planetary Nomenclature | Centros de Mons Mouton y Mons Malapert | https://planetarynames.wr.usgs.gov/ |
| NASA Quickmap y Moon Trek | Referencia visual y de diseño | https://quickmap.lroc.im-ldi.com/, https://trek.nasa.gov/moon/ |
| PGDA — Lunar Polar Illumination (producto 69) | Iluminación y visibilidad de la Tierra medias, 120 m (prototipo de sitios óptimos) | https://pgda.gsfc.nasa.gov/products/69 |
| PGDA — A New View of the Lunar South Pole from LOLA (producto 90) | Pendiente sobre 100 m, rugosidad y mapa de sombra permanente (prototipo) | https://pgda.gsfc.nasa.gov/products/90 |
| PGDA — South Pole LOLA DEM Mosaic (producto 81) | DEM de 5 m entre 87° y 90° S, para refinar candidatos | https://pgda.gsfc.nasa.gov/products/81 |
| Datos complementarios de Wueller et al. (2026) | 130 sitios de aterrizaje en las regiones Artemis, para validar | https://doi.org/10.5281/zenodo.17084058 |
| Moon Trek — polígonos de las 13 regiones Artemis de 2022 | Contornos de las regiones | https://trek.nasa.gov/moon/trekarcgis2/rest/services/A3_Named_regions/MapServer/0 |

## Software

- Skyfield: https://rhodesmill.org/skyfield/
- Three.js: https://threejs.org/

## Bibliografía

Citas verificadas contra la fuente (DOI, autores, volumen y páginas): ver [investigacion/verificacion-fuentes.md](investigacion/verificacion-fuentes.md).

- Park, R. S., Folkner, W. M., Williams, J. G., & Boggs, D. H. (2021). The JPL planetary and lunar ephemerides DE440 and DE441. *The Astronomical Journal, 161*(3), 105. https://doi.org/10.3847/1538-3881/abd414
- Smith, D. E. et al. (2010). The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews, 150*, 209–241. https://doi.org/10.1007/s11214-009-9512-y
- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus, 211*(2), 1066–1081. https://doi.org/10.1016/j.icarus.2010.10.030
- Bussey, D. B. J. et al. (2010). Illumination conditions of the south pole of the Moon derived using Kaguya topography. *Icarus, 208*(2), 558–564. https://doi.org/10.1016/j.icarus.2010.03.028
- Gläser, P. et al. (2018). Illumination conditions at the lunar poles: Implications for future exploration. *Planetary and Space Science, 162*, 170–178. https://doi.org/10.1016/j.pss.2017.07.006
- Barker, M. K. et al. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science, 203*, 105119. https://doi.org/10.1016/j.pss.2020.105119
- Wagner, R. V. et al. (2017). Coordinates of anthropogenic features on the Moon. *Icarus, 283*, 92–103. https://doi.org/10.1016/j.icarus.2016.05.011
- Wueller, L. et al. (2026). Assessing potential landing sites with favorable illumination and accessible, potentially volatile-rich permanently shadowed regions within Artemis candidate landing regions. *JGR Planets, 131*(3), e2025JE009434. https://doi.org/10.1029/2025JE009434
- Chavers, G. et al. *NASA's Human Landing System: The Strategy for the 2024 Mission and Future Sustainability*. NTRS 20200001606. https://ntrs.nasa.gov/api/citations/20200001606/downloads/20200001606.pdf
- NASA (2022, 19 de agosto). *NASA Identifies Candidate Regions for Landing Next Americans on Moon*. https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/
- NASA (2024, 28 de octubre). *NASA Provides Update on Artemis III Moon Landing Regions*. https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
- Williams, J.-P., Paige, D. A., Greenhagen, B. T., & Sefton-Nash, E. (2017). The global surface temperatures of the Moon as measured by the Diviner Lunar Radiometer Experiment. *Icarus, 283*, 300–325. https://doi.org/10.1016/j.icarus.2016.08.012
- Paige, D. A. et al. (2010). Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region. *Science, 330*(6003), 479–482. https://doi.org/10.1126/science.1187726
