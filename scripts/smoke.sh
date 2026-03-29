#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
SCENARIO="${SCENARIO:-cso}"

pass() { echo "OK: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# Helper: GET a URL, return the response body
get() { curl -fsS "$1"; }

# Helper: assert a JSON field equals an expected value
# Usage: assert_json <url> <jq_filter> <expected>
assert_json() {
  local url=$1 filter=$2 expected=$3
  local actual
  actual=$(get "$url" | jq -r "$filter" 2>/dev/null) \
    || fail "$url — could not parse JSON (is jq installed?)"
  [ "$actual" = "$expected" ] \
    || fail "$url — expected $filter = '$expected', got '$actual'"
}

# Helper: assert a JSON array returned by a URL is non-empty
assert_nonempty_array() {
  local url=$1 label=$2
  local count
  count=$(get "$url" | jq 'length' 2>/dev/null) \
    || fail "$url — could not parse JSON"
  [ "$count" -gt 0 ] \
    || fail "$label — expected non-empty array, got 0 results"
}

echo ""
echo "=== CyberSim smoke test (BASE_URL=$BASE_URL, SCENARIO=$SCENARIO) ==="
echo ""

# ── Health checks ────────────────────────────────────────────────────────────

get "$BASE_URL/health" >/dev/null
pass "GET /health"

assert_json "$BASE_URL/health" ".status" "ok"
pass "GET /health — status ok"

assert_json "$BASE_URL/health/db" ".ok" "true"
pass "GET /health/db — database reachable"

# ── Scenario-scoped static data endpoints ────────────────────────────────────

assert_nonempty_array "$BASE_URL/systems?scenarioSlug=$SCENARIO"     "GET /systems?scenarioSlug=$SCENARIO"
pass "GET /systems?scenarioSlug=$SCENARIO"

assert_nonempty_array "$BASE_URL/mitigations?scenarioSlug=$SCENARIO" "GET /mitigations?scenarioSlug=$SCENARIO"
pass "GET /mitigations?scenarioSlug=$SCENARIO"

assert_nonempty_array "$BASE_URL/injections?scenarioSlug=$SCENARIO"  "GET /injections?scenarioSlug=$SCENARIO"
pass "GET /injections?scenarioSlug=$SCENARIO"

assert_nonempty_array "$BASE_URL/responses?scenarioSlug=$SCENARIO"   "GET /responses?scenarioSlug=$SCENARIO"
pass "GET /responses?scenarioSlug=$SCENARIO"

assert_nonempty_array "$BASE_URL/actions?scenarioSlug=$SCENARIO"     "GET /actions?scenarioSlug=$SCENARIO"
pass "GET /actions?scenarioSlug=$SCENARIO"

assert_nonempty_array "$BASE_URL/curveballs?scenarioSlug=$SCENARIO"  "GET /curveballs?scenarioSlug=$SCENARIO"
pass "GET /curveballs?scenarioSlug=$SCENARIO"

# ── Scenario slug validation ──────────────────────────────────────────────────
# An unknown slug should return 404, not a 500 or empty array.

STATUS=$(curl -o /dev/null -w "%{http_code}" -fsS \
  "$BASE_URL/systems?scenarioSlug=no-such-scenario" 2>/dev/null || true)
[ "$STATUS" = "404" ] \
  || fail "GET /systems?scenarioSlug=no-such-scenario — expected 404, got $STATUS"
pass "GET /systems?scenarioSlug=no-such-scenario — returns 404"

# ── Import route rejects bad input without touching the DB ───────────────────

STATUS=$(curl -o /dev/null -w "%{http_code}" -s -X POST "$BASE_URL/admin/scenarios/import" \
  -H "Content-Type: application/json" \
  -d '{"scenarioSlug":"cso"}')
[ "$STATUS" = "400" ] \
  || fail "POST /admin/scenarios/import (missing password) — expected 400, got $STATUS"
pass "POST /admin/scenarios/import — rejects missing password with 400"

STATUS=$(curl -o /dev/null -w "%{http_code}" -s -X POST "$BASE_URL/admin/scenarios/import" \
  -H "Content-Type: application/json" \
  -d '{"scenarioSlug":"CSO INVALID","password":"anything"}')
[ "$STATUS" = "400" ] \
  || fail "POST /admin/scenarios/import (invalid slug) — expected 400, got $STATUS"
pass "POST /admin/scenarios/import — rejects invalid slug with 400"

echo ""
echo "=== All checks passed ==="
echo ""
