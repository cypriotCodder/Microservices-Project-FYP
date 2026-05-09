#!/usr/bin/env bash
# run-tests.sh — Sequential isolated stress test.
#
# Run 1: Microservices only  → ./results/results-microservices.json
# Run 2: Monolith only       → ./results/results-monolith.json
# Comparison summary printed at end.
#
# Usage:  ./run-tests.sh

# NOTE: no 'set -e' — k6 exits 99 when thresholds are crossed (expected),
# which would abort the script before the monolith run starts.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

MONOLITH_URL="${MONOLITH_URL:-http://host.docker.internal:4000}"
MICROSERVICES_URL="${MICROSERVICES_URL:-http://host.docker.internal:8080}"

MONOLITH_DIR="/Users/nedim/Desktop/myRepo/FYP/deneme1/monolith"
MICROSERVICES_DIR="/Users/nedim/Desktop/myRepo/FYP/deneme1/microservices"

mkdir -p "$SCRIPT_DIR/results"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Sequential Architectural Stress Test               ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Max VUs : 50                                            ║"
echo "║  Duration: ~3m30s per run                                ║"
echo "║  Grafana : http://localhost:3000                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── RUN 1: MICROSERVICES ──────────────────────────────────────────────────────
echo "▶  Run 1/2 — MICROSERVICES  (target: $MICROSERVICES_URL)"
echo "   Starting in 3 seconds..."
sleep 3

DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose run --no-deps -T --rm \
    -e TARGET_URL="$MICROSERVICES_URL" \
    -e ARCH="microservices" \
    k6 run --tag arch=microservices \
           --out influxdb=http://influxdb:8086/k6 \
           --summary-export=/results/results-microservices.json \
           /scripts/loadtest.js || true
MS_CODE=$?

echo ""
echo "✅ Run 1 complete (exit $MS_CODE). Stopping microservices app layer..."
(cd "$MICROSERVICES_DIR" && DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose stop api-gateway product-service order-service auth-service llm-service recommendation-service content-creator 2>&1 | grep -v "^$")
echo ""

# ─── RUN 2: MONOLITH ──────────────────────────────────────────────────────────
echo "▶  Run 2/2 — MONOLITH  (target: $MONOLITH_URL)"
echo "   Starting in 3 seconds..."
sleep 3

DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose run --no-deps -T --rm \
    -e TARGET_URL="$MONOLITH_URL" \
    -e ARCH="monolith" \
    k6 run --tag arch=monolith \
           --out influxdb=http://influxdb:8086/k6 \
           --summary-export=/results/results-monolith.json \
           /scripts/loadtest.js || true
M_CODE=$?

echo ""
echo "✅ Run 2 complete (exit $M_CODE). Stopping monolith app layer..."
(cd "$MONOLITH_DIR" && DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose stop monolith-backend 2>&1 | grep -v "^$")
echo ""

# ─── COMPARISON ───────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  RESULTS COMPARISON"
echo "══════════════════════════════════════════════════════════"

python3 - <<'PYEOF'
import json, sys

def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        print(f"  ⚠️  Could not load {path}: {e}")
        return None

ms = load("./results/results-microservices.json")
mo = load("./results/results-monolith.json")

if not ms or not mo:
    sys.exit(1)

def m(data, key, stat):
    try:
        return data["metrics"][key][stat]
    except:
        return None

def fmt(v, unit="ms"):
    if v is None: return "n/a"
    if unit == "ms": return f"{v*1000:.1f}ms" if v < 1 else f"{v:.2f}s"
    if unit == "%":  return f"{v*100:.1f}%"
    return str(v)

rows = [
    ("http_req_duration",     "avg",   "ms", "Avg latency"),
    ("http_req_duration",     "p(95)", "ms", "p95 latency"),
    ("http_req_duration",     "max",   "ms", "Max latency"),
    ("http_req_failed",       "rate",  "%",  "Error rate"),
    ("iterations",            "count", None, "Iterations"),
    ("http_reqs",             "count", None, "HTTP requests"),
]

print(f"\n  {'Metric':<22} {'Microservices':>16} {'Monolith':>16}")
print(f"  {'-'*22} {'-'*16} {'-'*16}")
for key, stat, unit, label in rows:
    mv = m(ms, key, stat)
    ov = m(mo, key, stat)
    if unit == "ms":
        ms_fmt = fmt(mv, "ms") if mv is not None else "n/a"
        mo_fmt = fmt(ov, "ms") if ov is not None else "n/a"
    elif unit == "%":
        ms_fmt = f"{(mv or 0)*100:.1f}%"
        mo_fmt = f"{(ov or 0)*100:.1f}%"
    else:
        ms_fmt = str(int(mv)) if mv is not None else "n/a"
        mo_fmt = str(int(ov)) if ov is not None else "n/a"
    print(f"  {label:<22} {ms_fmt:>16} {mo_fmt:>16}")

print("")
PYEOF

echo "Grafana dashboard    : http://localhost:3000"
echo "Microservices JSON   : $SCRIPT_DIR/results/results-microservices.json"
echo "Monolith JSON        : $SCRIPT_DIR/results/results-monolith.json"
echo ""
echo "Restarting stopped services..."
(cd "$MICROSERVICES_DIR" && docker compose up -d 2>&1 | tail -3)
(cd "$MONOLITH_DIR" && docker compose up -d monolith-backend 2>&1 | tail -3)
echo "  Done."
echo ""

# ─── CLEANUP — delete k6 test comments ───────────────────────────────────────
# Runs after both test runs complete. Deletes only comments whose content
# starts with "k6 " — products, orders, and real user data are untouched.
# Both endpoints are unauthenticated so this never silently fails.
echo "Cleaning up k6 test comments..."

# Wait for containers to be fully ready after restart
echo "Waiting for services to be ready..."
sleep 15

curl -sf http://localhost:4000/products > /dev/null && echo "Monolith ready" || echo "Monolith not ready"
curl -sf http://localhost:8080/products > /dev/null && echo "Microservices ready" || echo "Microservices not ready"

MONO_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE http://localhost:4000/products/comments/k6)
MONO_CODE=$(echo "$MONO_RESPONSE" | tail -1)
MONO_MSG=$(echo "$MONO_RESPONSE" | head -1)
if [ "$MONO_CODE" == "200" ]; then
    echo "  ✅ Monolith:      $MONO_MSG"
else
    echo "  ❌ Monolith cleanup failed [HTTP $MONO_CODE]: $MONO_MSG"
fi

MICRO_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE http://localhost:8080/products/comments/k6)
MICRO_CODE=$(echo "$MICRO_RESPONSE" | tail -1)
MICRO_MSG=$(echo "$MICRO_RESPONSE" | head -1)
if [ "$MICRO_CODE" == "200" ] || [ "$MICRO_CODE" == "202" ]; then
    echo "  ✅ Microservices: $MICRO_MSG"
else
    echo "  ❌ Microservices cleanup failed [HTTP $MICRO_CODE]: $MICRO_MSG"
fi
echo ""
