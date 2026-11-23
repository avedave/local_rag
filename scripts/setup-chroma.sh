#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/chroma-env"

if [ -x "$VENV_DIR/bin/chroma" ]; then
  echo "[chroma] Virtual environment already set up at $VENV_DIR"
  exit 0
fi

echo "[chroma] Setting up local Python environment for Chroma DB..."
if command -v uv >/dev/null 2>&1; then
  uv venv --python 3.12 "$VENV_DIR"
  uv pip install --python "$VENV_DIR/bin/python" chromadb
else
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
  "$VENV_DIR/bin/pip" install chromadb
fi

echo "[chroma] Installed: $("$VENV_DIR/bin/chroma" --version)"
