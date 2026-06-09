#!/usr/bin/env bash
# run-demo.sh — Live demo: both architectures run IN PARALLEL.
#
# Both k6 instances start simultaneously so Grafana shows both latency
# curves moving at the same time — the visual the audience needs.
#
# Usage:  ./run-demo.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

MONOLITH_URL="${MONOLITH_URL:-http://host.docker.internal:4000}"
MICROSERVICES_URL="${MICROSERVICES_URL:-http://host.docker.internal:8080}"

MONOLITH_DIR="/Users/nedim/Desktop/myRepo/FYP/deneme1/monolith"
MICROSERVICES_DIR="/Users/nedim/Desktop/myRepo/FYP/deneme1/microservices"

mkdir -p "$SCRIPT_DIR/results"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Live Demo — Parallel Write-Heavy Test              ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Max VUs : 150 per architecture (300 total)              ║"
echo "║  Duration: ~1 min (both run simultaneously)              ║"
echo "║  Mode    : Write-heavy (no LLM calls)                    ║"
echo "║  Grafana : http://localhost:3000                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── LAUNCH BOTH IN PARALLEL ──────────────────────────────────────────────────
echo "▶  Launching MICROSERVICES + MONOLITH simultaneously..."
echo "   Both streams write to InfluxDB — watch Grafana for live split."
echo ""

# Microservices k6 (background)
DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose run --no-deps -T --rm \
    --name k6-demo-micro \
    -e TARGET_URL="$MICROSERVICES_URL" \
    -e ARCH="microservices" \
    k6 run --tag arch=microservices \
           --out influxdb=http://influxdb:8086/k6 \
           --summary-export=/results/results-demo-microservices.json \
           /scripts/loadtest-demo.js 2>&1 | sed 's/^/  [micro] /' &
MICRO_PID=$!

# Small stagger so InfluxDB doesn't choke on two simultaneous connections
sleep 2

# Monolith k6 (background)
DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose run --no-deps -T --rm \
    --name k6-demo-mono \
    -e TARGET_URL="$MONOLITH_URL" \
    -e ARCH="monolith" \
    k6 run --tag arch=monolith \
           --out influxdb=http://influxdb:8086/k6 \
           --summary-export=/results/results-demo-monolith.json \
           /scripts/loadtest-demo.js 2>&1 | sed 's/^/  [mono]  /' &
MONO_PID=$!

echo "  PIDs: micro=$MICRO_PID  mono=$MONO_PID"
echo "  Waiting for both to finish..."
echo ""

# Wait for both to complete
wait $MICRO_PID 2>/dev/null
wait $MONO_PID 2>/dev/null

echo ""
echo "✅ Both runs complete."
echo ""

# ─── COMPARISON ───────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  DEMO RESULTS COMPARISON"
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

ms = load("./results/results-demo-microservices.json")
mo = load("./results/results-demo-monolith.json")

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
echo "Microservices JSON   : $SCRIPT_DIR/results/results-demo-microservices.json"
echo "Monolith JSON        : $SCRIPT_DIR/results/results-demo-monolith.json"
echo ""

# ─── CLEANUP ──────────────────────────────────────────────────────────────────
echo "Cleaning up k6 test comments..."
sleep 5

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
