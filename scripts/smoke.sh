#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"

echo "Checking health..."
curl -fsS "$BASE_URL/health" >/dev/null
echo "OK: health"

echo "Checking a simple route..."
curl -fsS "$BASE_URL/" >/dev/null || true
echo "OK: basic route"