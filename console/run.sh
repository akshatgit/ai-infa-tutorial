#!/usr/bin/env bash
# Serve the course website. No GPU, no tunnel, no token.
#   ./run.sh                 http://127.0.0.1:8080
#   HOST=0.0.0.0 ./run.sh    serve it to the LAN
set -euo pipefail
cd "$(dirname "$0")"

PY=python3
[ -x ../.venv/bin/python ] && PY=../.venv/bin/python
[ -x .venv/bin/python ] && PY=.venv/bin/python
if ! "$PY" -c "import fastapi, uvicorn" 2>/dev/null; then
  echo "installing dependencies into .venv"
  python3 -m venv .venv && .venv/bin/pip -q install -r requirements.txt
  PY=.venv/bin/python
fi
exec "$PY" server.py "$@"
