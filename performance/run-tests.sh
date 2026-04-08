#!/usr/bin/env bash
# run-tests.sh — fire both k6 stress tests concurrently.
# Usage:
#   ./run-tests.sh              (uses defaults below)
#   VUS=200 DURATION=2m ./run-tests.sh
#
# Both processes write to InfluxDB simultaneously so Grafana shows both
# arch series on the same time axis — enabling a true side-by-side comparison.

set -e

MONOLITH_URL="${MONOLITH_URL:-http://host.docker.internal:4000}"
MICROSERVICES_URL="${MICROSERVICES_URL:-http://host.docker.internal:8080}"
VUS="${VUS:-}"          # leave empty to use the options.stages ramp in loadtest.js
DURATION="${DURATION:-}" # leave empty to use the options.stages duration

# Build optional CLI overrides (only set if user provided them)
EXTRA_FLAGS=""
if [ -n "$VUS" ];      then EXTRA_FLAGS="$EXTRA_FLAGS --vus $VUS"; fi
if [ -n "$DURATION" ]; then EXTRA_FLAGS="$EXTRA_FLAGS --duration $DURATION"; fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Architectural Stress Test — Concurrent Run         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Monolith      → $MONOLITH_URL"
echo "║  Microservices → $MICROSERVICES_URL"
echo "║  Grafana       → http://localhost:3000"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Open Grafana NOW and set time range to: Last 10 minutes"
echo "   Dashboard: 'Architectural Contrast Benchmark' (auto-refresh 5s)"
echo ""
echo "Starting both tests in 3 seconds..."
sleep 3

# ── Microservices (fires first — usually healthier start) ──────────────────────
ARCH=microservices TARGET_URL="$MICROSERVICES_URL" \
  docker compose run -T --rm \
    -e TARGET_URL="$MICROSERVICES_URL" \
    -e ARCH="microservices" \
    k6 run --tag arch=microservices \
           --summary-export=/results/results-microservices.json \
           $EXTRA_FLAGS /scripts/loadtest.js \
  2>&1 | sed 's/^/[microservices] /' &
MS_PID=$!

# Small stagger so setup() fetches don't race the same endpoint
sleep 1

# ── Monolith ───────────────────────────────────────────────────────────────────
ARCH=monolith TARGET_URL="$MONOLITH_URL" \
  docker compose run -T --rm \
    -e TARGET_URL="$MONOLITH_URL" \
    -e ARCH="monolith" \
    k6 run --tag arch=monolith \
           --summary-export=/results/results-monolith.json \
           $EXTRA_FLAGS /scripts/loadtest.js \
  2>&1 | sed 's/^/[monolith]      /' &
M_PID=$!

echo ""
echo "✅ Both k6 processes started. Streaming output..."
echo "   [microservices] lines = microservices arch"
echo "   [monolith]      lines = monolith arch"
echo ""

# Wait for both — collect exit codes
wait $MS_PID; MS_CODE=$?
wait $M_PID;  M_CODE=$?

echo ""
echo "══════════════════════════════════════════"
echo "  Test run complete"
echo "══════════════════════════════════════════"
echo "  Microservices exit: $MS_CODE  (0=thresholds met, non-zero=p95>1s)"
echo "  Monolith      exit: $M_CODE   (always 0 — abortOnFail:false)"
echo ""
echo "  View results: http://localhost:3000"
