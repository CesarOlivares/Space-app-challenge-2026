#!/usr/bin/env bash
# Levanta la aplicación completa (API + frontend) en http://localhost:8000
set -euo pipefail

cd "$(dirname "$0")/backend"

# Aísla el entorno de paquetes externos (p. ej. ROS agrega plugins de pytest vía PYTHONPATH).
unset PYTHONPATH

if ! .venv/bin/python -c "import fastapi, uvicorn" 2>/dev/null; then
  rm -rf .venv
  # En Debian/Ubuntu sin python3-venv falla la creación con pip; se usa el pip del sistema.
  python3 -m venv .venv 2>/dev/null || { rm -rf .venv; python3 -m venv --without-pip .venv; }
  if .venv/bin/python -m pip --version >/dev/null 2>&1; then
    .venv/bin/python -m pip install -r requirements.txt
  else
    python3 -m pip --python .venv/bin/python install -r requirements.txt
  fi
fi

if [ "${1:-}" = "test" ]; then
  exec .venv/bin/python -m pytest
fi

exec .venv/bin/python -m uvicorn app.main:app --reload --port "${PORT:-8000}"
