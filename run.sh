#!/usr/bin/env bash
# Levanta la aplicación completa (API + frontend) en http://localhost:8000
#   ./run.sh        levanta el servidor
#   ./run.sh test   corre las pruebas
#   ./run.sh data   descarga kernels, texturas (4K y 8K), relieve y Three.js (--dem: también el DEM polar LOLA, 116 MB; --no-hires: sin 8K ni relieve)
#   ./run.sh horizons  recalcula las máscaras de horizonte con el DEM
set -euo pipefail

cd "$(dirname "$0")/backend"

# Aísla el entorno de paquetes externos (p. ej. ROS agrega plugins de pytest vía PYTHONPATH).
unset PYTHONPATH

# 1. Detectar el comando Python adecuado en el sistema (compatible con Linux, macOS y Windows/Git Bash)
SYS_PYTHON=""
for cmd in python3 python py; do
  if command -v "$cmd" >/dev/null 2>&1; then
    if "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >/dev/null 2>&1; then
      SYS_PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$SYS_PYTHON" ]; then
  # Probar 'py -3' si existe el launcher de Windows
  if command -v py >/dev/null 2>&1 && py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >/dev/null 2>&1; then
    SYS_PYTHON="py -3"
  else
    echo "Error: Se requiere Python 3.10 o superior y no fue encontrado en el PATH." >&2
    exit 1
  fi
fi

# 2. Localizar el ejecutable dentro del venv (.venv/Scripts/python.exe en Windows, .venv/bin/python en Unix)
get_venv_python() {
  if [ -f ".venv/Scripts/python.exe" ]; then
    echo ".venv/Scripts/python.exe"
  elif [ -f ".venv/Scripts/python" ]; then
    echo ".venv/Scripts/python"
  elif [ -f ".venv/bin/python" ]; then
    echo ".venv/bin/python"
  else
    echo ""
  fi
}

VENV_PYTHON=$(get_venv_python)

# 3. Crear el entorno virtual si no existe
if [ -z "$VENV_PYTHON" ] || [ ! -f "$VENV_PYTHON" ]; then
  echo "Creando entorno virtual en backend/.venv..."
  $SYS_PYTHON -m venv .venv 2>/dev/null || { rm -rf .venv; $SYS_PYTHON -m venv --without-pip .venv; }
  VENV_PYTHON=$(get_venv_python)
  if [ -z "$VENV_PYTHON" ] || [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: No se pudo localizar el ejecutable de python en .venv tras la creación." >&2
    exit 1
  fi
fi

# 4. Reinstalar dependencias solo cuando cambia requirements.txt
needs_install=0
if [ ! -f .venv/requirements.installed ]; then
  needs_install=1
elif command -v cmp >/dev/null 2>&1; then
  if ! cmp -s requirements.txt .venv/requirements.installed; then
    needs_install=1
  fi
elif command -v diff >/dev/null 2>&1; then
  if ! diff -q requirements.txt .venv/requirements.installed >/dev/null 2>&1; then
    needs_install=1
  fi
else
  needs_install=1
fi

if [ "$needs_install" -eq 1 ]; then
  echo "Instalando/actualizando dependencias desde requirements.txt..."
  if "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
    "$VENV_PYTHON" -m pip install -q -r requirements.txt
  else
    $SYS_PYTHON -m pip -q --python "$VENV_PYTHON" install -r requirements.txt
  fi
  cp requirements.txt .venv/requirements.installed
fi

# 5. Despacho de comandos
case "${1:-}" in
  test) exec "$VENV_PYTHON" -m pytest "${@:2}" ;;
  data) exec "$VENV_PYTHON" scripts/download_data.py "${@:2}" ;;
  horizons) exec "$VENV_PYTHON" scripts/compute_horizons.py "${@:2}" ;;
esac

# 6. Comprobar que los datos existen antes de levantar el servidor
if [ ! -f data/kernels/de440s.bsp ]; then
  echo "Faltan los datos externos: ejecuta primero ./run.sh data" >&2
  exit 1
fi

PORT="${PORT:-8000}"
echo "Iniciando Lunar Site Explorer en http://localhost:$PORT"
exec "$VENV_PYTHON" -m uvicorn app.main:app --reload --port "$PORT"
