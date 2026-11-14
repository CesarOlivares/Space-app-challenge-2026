#!/usr/bin/env bash
# Levanta la aplicación completa (API + frontend) en http://localhost:8000
#   ./run.sh        levanta el servidor
#   ./run.sh test   corre las pruebas
#   ./run.sh data   descarga kernels, texturas y Three.js (--dem: también el DEM polar LOLA, 116 MB)
#   ./run.sh horizons  recalcula las máscaras de horizonte con el DEM
set -euo pipefail

cd "$(dirname "$0")/backend"

# Aísla el entorno de paquetes externos (p. ej. ROS agrega plugins de pytest vía PYTHONPATH).
unset PYTHONPATH

if [ ! -x .venv/bin/python ]; then
  # En Debian/Ubuntu sin python3-venv falla la creación con pip; se usa el pip del sistema.
  python3 -m venv .venv 2>/dev/null || { rm -rf .venv; python3 -m venv --without-pip .venv; }
fi

# Reinstala dependencias solo cuando cambia requirements.txt.
if ! cmp -s requirements.txt .venv/requirements.installed; then
  if .venv/bin/python -m pip --version >/dev/null 2>&1; then
    .venv/bin/python -m pip install -q -r requirements.txt
  else
    python3 -m pip -q --python .venv/bin/python install -r requirements.txt
  fi
  cp requirements.txt .venv/requirements.installed
fi

case "${1:-}" in
  test) exec .venv/bin/python -m pytest ;;
  data) exec .venv/bin/python scripts/download_data.py "${@:2}" ;;
  horizons) exec .venv/bin/python scripts/compute_horizons.py ;;
esac

if [ ! -f data/kernels/de440s.bsp ]; then
  echo "Faltan los datos externos: ejecuta primero ./run.sh data" >&2
  exit 1
fi

exec .venv/bin/python -m uvicorn app.main:app --reload --port "${PORT:-8000}"
