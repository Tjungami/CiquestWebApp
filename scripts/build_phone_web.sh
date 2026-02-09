#!/usr/bin/env bash
set -euo pipefail

PHONE_APP_DIR="${PHONE_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/phone_app}"
OUT_DIR="${PHONE_WEB_OUT_DIR:-$(cd "$(dirname "$0")/.." && pwd)/ciquest_phone}"

if [ ! -f "$PHONE_APP_DIR/package.json" ]; then
  echo "phone_app not found: $PHONE_APP_DIR" >&2
  exit 1
fi

cd "$PHONE_APP_DIR"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

npx expo export --platform web --output-dir "$OUT_DIR";
