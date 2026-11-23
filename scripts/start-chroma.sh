#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/chroma-env"
DATA_DIR="$ROOT_DIR/data/chroma"

if [ ! -x "$VENV_DIR/bin/chroma" ]; then
  echo "[chroma] Chroma environment missing — running setup first..."
  bash "$ROOT_DIR/scripts/setup-chroma.sh"
fi

mkdir -p "$DATA_DIR"

HOST="${CHROMA_HOST:-127.0.0.1}"
PORT="${CHROMA_PORT:-8000}"

echo "[chroma] Starting local Chroma DB on http://${HOST}:${PORT} (data: ${DATA_DIR})"
exec "$VENV_DIR/bin/chroma" run --path "$DATA_DIR" --host "$HOST" --port "$PORT"
