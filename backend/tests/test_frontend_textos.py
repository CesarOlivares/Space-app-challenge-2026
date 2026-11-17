"""Textos de la interfaz: cada clave existe en español y en inglés, y toda clave que se usa existe.

El frontend no tiene herramientas de Node a propósito, así que la revisión se hace aquí, leyendo
los fuentes como texto. Atrapa el error más común al editar la interfaz: agregar un texto en un
solo idioma o escribir mal una clave (la app mostraría la clave en vez del texto).
"""

import re
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
I18N = (FRONTEND / "src" / "i18n.js").read_text(encoding="utf-8")
KEY = re.compile(r'^ {4}"?([\w.]+)"?:', re.M)  # claves del diccionario: 4 espacios de sangría
COMMENT = re.compile(r"^\s*//.*$|/\*.*?\*/", re.M | re.S)


def _keys(language: str) -> set[str]:
    start = I18N.index(f"  {language}: {{")
    end = I18N.index("  en: {") if language == "es" else len(I18N)
    return set(KEY.findall(I18N[start:end]))


def _sources() -> str:
    files = [p for p in (FRONTEND / "src").rglob("*.js") if p.name != "i18n.js"]
    # Sin comentarios: ahí hay claves de ejemplo que no tienen por qué existir.
    code = "\n".join(COMMENT.sub("", p.read_text(encoding="utf-8")) for p in files)
    return code + (FRONTEND / "index.html").read_text(encoding="utf-8")


def test_mismas_claves_en_espanol_e_ingles():
    es, en = _keys("es"), _keys("en")
    assert not es - en, f"faltan en inglés: {sorted(es - en)}"
    assert not en - es, f"faltan en español: {sorted(en - es)}"


def test_toda_clave_usada_existe():
    known = _keys("es")
    source = _sources()
    used = set(re.findall(r'\bt\(\s*"([\w.]+)"', source))
    used |= set(re.findall(r'data-i18n="([\w.]+)"', source))
    for attrs in re.findall(r'data-i18n-attr="([^"]+)"', source):
        used |= {pair.split(":", 1)[1].strip() for pair in attrs.split(";") if ":" in pair}
    missing = sorted(used - known)
    assert not missing, f"claves usadas que no existen en i18n.js: {missing}"


def test_los_parametros_coinciden_entre_idiomas():
    """Un "{n}" que está en un idioma y no en el otro deja el número fuera de la frase."""
    def params(language):
        start = I18N.index(f"  {language}: {{")
        end = I18N.index("  en: {") if language == "es" else len(I18N)
        return {k: set(re.findall(r"\{(\w+)\}", v))
                for k, v in re.findall(r'^\s+"([\w.]+)": "((?:[^"\\]|\\.)*)"', I18N[start:end], re.M)}
    es, en = params("es"), params("en")
    distintos = sorted(k for k in es.keys() & en.keys() if es[k] != en[k])
    assert not distintos, f"parámetros distintos entre idiomas: {distintos}"
