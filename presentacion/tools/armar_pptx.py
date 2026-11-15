"""Arma el PPTX del pitch: una lámina 16:9 por clip, con el video a pantalla completa que se reproduce solo.

Debajo de cada video va su último cuadro como imagen (si un reproductor no carga el video, igual se ve la lámina).
Uso: PYTHONPATH=<carpeta con python-pptx> python armar_pptx.py <carpeta de videos> <salida.pptx>
"""
import copy, os, subprocess, sys
from lxml import etree
from pptx import Presentation
from pptx.util import Emu

VID, OUT = sys.argv[1], sys.argv[2]
W, H = Emu(12192000), Emu(6858000)  # 13,333 × 7,5 pulgadas (16:9)
NOTAS = {
    1: "Portada. (Presentación del equipo.)",
    2: "Recordemos el primer alunizaje: una serie de problemas llevaron a que Neil Armstrong tuviera que tomar el control manual y encontrar un lugar seguro para aterrizar de forma intuitiva. Hoy, más de 50 años después, queremos volver a la Luna. Pero esta vez el objetivo es mucho más desafiante: el polo sur lunar.",
    3: "Ahí, las condiciones pueden cambiar drásticamente. Un simple retraso puede transformar un sitio viable en uno donde la energía o la comunicación no estén disponibles.",
    4: "Y aunque contamos con enormes cantidades de información de la NASA, está distribuida en distintas plataformas, y eso atrasa a los equipos de planificación al tomar decisiones críticas. Para esto nace Zenith. (En el video, las fuentes se juntan a los 6,6 s.)",
    5: "Una plataforma interactiva que, con referencias como las del Jet Propulsion Laboratory, permite explorar la superficie lunar, seleccionar cualquier ubicación y evaluar su viabilidad para una misión de dos semanas, considerando tres factores: energía solar, comunicación con la Tierra y condiciones del terreno.",
    6: "Todo con datos científicos reales de la NASA. QuickMap, Moon Trek y Horizons del JPL entregan datos excelentes; Zenith reúne lo que normalmente se consulta por separado y lo convierte en una herramienta para comparar escenarios. No buscamos reemplazar los análisis especializados, sino identificar rápido qué sitios y fechas merecen un estudio más profundo.",
    7: "Nuestros próximos pasos: validar Zenith con sitios y misiones conocidas, y sumar el análisis térmico y el valor científico. Hoy estamos preparando el regreso a la Luna; queremos ayudar a preparar el camino hacia lo que viene después. Somos Usach Space Program, muchas gracias.",
}
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
AUTOPLAY = """<p:timing xmlns:p="%s"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>
<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>
<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>
<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="%d" fill="hold"/><p:tgtEl><p:spTgt spid="%d"/></p:tgtEl></p:cBhvr></p:cmd>
</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>
</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>
<p:video><p:cMediaNode vol="80000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="%d"/></p:tgtEl></p:cMediaNode></p:video>
</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>"""

def duracion_ms(mp4):
    import imageio_ffmpeg
    out = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", mp4], capture_output=True, text=True).stderr
    hh, mm, ss = out.split("Duration: ")[1].split(",")[0].split(":")
    return int((int(hh) * 3600 + int(mm) * 60 + float(ss)) * 1000)

prs = Presentation(); prs.slide_width, prs.slide_height = W, H
blank = prs.slide_layouts[6]
for i in range(1, 8):
    mp4 = os.path.join(VID, f"lamina-{i}.mp4")
    s = prs.slides.add_slide(blank)
    s.shapes.add_picture(os.path.join(VID, f"lamina-{i}-final.jpg"), 0, 0, W, H)  # respaldo si el video no carga
    mv = s.shapes.add_movie(mp4, 0, 0, W, H, poster_frame_image=os.path.join(VID, f"lamina-{i}-primero.jpg"), mime_type="video/mp4")
    sld = s._element
    for t in sld.findall(f"{{{P}}}timing"): sld.remove(t)
    ms, spid = duracion_ms(mp4), mv.shape_id
    timing = etree.fromstring(AUTOPLAY % (P, ms, spid, spid))
    ext = sld.find(f"{{{P}}}extLst")
    (ext.addprevious(timing) if ext is not None else sld.append(timing))
    s.notes_slide.notes_text_frame.text = NOTAS[i]
prs.save(OUT)
print("ok", OUT, os.path.getsize(OUT) // 1024, "KB")
