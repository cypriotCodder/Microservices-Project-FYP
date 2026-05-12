#!/usr/bin/env bash
# run-chaos-test.sh — Pumba chaos test with automated result saving.
#
# What this does:
#   1. Pulls Pumba image if not cached
#   2. Starts Pumba to inject 5s network delay on llm-service
#   3. Runs k6 load test against the microservices stack
#   4. Saves JSON summary → results/results-chaos.json
#   5. Exports Grafana dashboard as PNG → results/grafana-chaos-snapshot.png
#   6. Stops Pumba cleanly
#
# Usage:  ./run-chaos-test.sh
#
# Prerequisites:
#   - Microservices stack must be running:  (cd ../microservices && docker compose up -d)
#   - Performance stack must be running:    (cd performance && docker compose up -d)
#   - Both export the same InfluxDB at http://localhost:8086

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MICROSERVICES_DIR="$(cd "$SCRIPT_DIR/../microservices" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
MICROSERVICES_URL="${MICROSERVICES_URL:-http://host.docker.internal:8080}"

mkdir -p "$RESULTS_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Pumba Chaos Engineering Test                    ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Fault:    5,000ms delay on llm-service                  ║"
echo "║  Duration: ~5 min Pumba + ~5 min k6 ramp                 ║"
echo "║  Target:   $MICROSERVICES_URL"
echo "║  Results:  $RESULTS_DIR/results-chaos.json"
echo "║  Grafana:  $GRAFANA_URL"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── STEP 1: Pre-pull Pumba image ─────────────────────────────────────────────
echo "▶  Pulling Pumba image (gaiaadm/pumba:latest)..."
docker pull gaiaadm/pumba:latest
echo ""

# ─── STEP 2: Start Pumba chaos injection ──────────────────────────────────────
echo "▶  Starting Pumba — injecting 5s delay on llm-service..."
(cd "$MICROSERVICES_DIR" && docker compose --profile chaos up pumba -d)
echo "   Pumba is running. Waiting 5s for injection to stabilise..."
sleep 5
echo ""

# ─── STEP 3: Run k6 load test ─────────────────────────────────────────────────
echo "▶  Starting k6 chaos load test against $MICROSERVICES_URL ..."
echo "   Results will be saved to: $RESULTS_DIR/results-chaos.json"
echo ""

DOCKER_CONFIG=$(mktemp -d) /usr/local/bin/docker-compose \
    -f "$SCRIPT_DIR/docker-compose.yml" \
    run --no-deps -T --rm \
    -e TARGET_URL="$MICROSERVICES_URL" \
    -e ARCH="chaos" \
    k6 run --tag arch=chaos \
           --out influxdb=http://influxdb:8086/k6 \
           --summary-export=/results/results-chaos.json \
           /scripts/loadtest.js || true

K6_CODE=$?
echo ""
echo "✅ k6 run complete (exit $K6_CODE)."
echo ""

# ─── STEP 4: Export Grafana dashboard snapshot ────────────────────────────────
# Grafana render API produces a PNG — perfect for dissertation figures.
# The dashboard UID is pulled from the provisioned architectural_contrast.json.
# Falls back gracefully if Grafana renderer plugin is not installed.
echo "▶  Attempting Grafana PNG export..."

DASHBOARD_UID=$(grep -o '"uid":"[^"]*"' "$SCRIPT_DIR/grafana/dashboards/architectural_contrast.json" 2>/dev/null | head -1 | cut -d'"' -f4)

if [ -z "$DASHBOARD_UID" ]; then
    # Fall back to the k6 dashboard
    DASHBOARD_UID=$(grep -o '"uid":"[^"]*"' "$SCRIPT_DIR/grafana/dashboards/k6.json" 2>/dev/null | head -1 | cut -d'"' -f4)
fi

SNAPSHOT_FILE="$RESULTS_DIR/grafana-chaos-snapshot.png"

if [ -n "$DASHBOARD_UID" ]; then
    # Calculate the time window: from 10 minutes ago to now (covers the k6 run)
    NOW_MS=$(date +%s)000
    FROM_MS=$(( ($(date +%s) - 900) * 1000 ))  # 15 min window

    RENDER_URL="${GRAFANA_URL}/render/d/${DASHBOARD_UID}?orgId=1&from=${FROM_MS}&to=${NOW_MS}&width=1600&height=900&tz=UTC"

    HTTP_CODE=$(curl -s -o "$SNAPSHOT_FILE" -w "%{http_code}" "$RENDER_URL")

    if [ "$HTTP_CODE" = "200" ] && [ -s "$SNAPSHOT_FILE" ]; then
        echo "   ✅ Grafana PNG saved → $SNAPSHOT_FILE"
    else
        echo "   ⚠️  Grafana render returned HTTP $HTTP_CODE."
        echo "      The renderer plugin may not be installed."
        echo "      → Manual export: $GRAFANA_URL/d/$DASHBOARD_UID"
        echo "      → Use Grafana's Share > Export > Save as PNG in the UI"
        rm -f "$SNAPSHOT_FILE"
    fi
else
    echo "   ⚠️  Could not detect dashboard UID. Skipping PNG export."
    echo "      → Manual export: $GRAFANA_URL"
fi
echo ""

# ─── STEP 5: Stop Pumba ────────────────────────────────────────────────────────
echo "▶  Stopping Pumba chaos injector..."
(cd "$MICROSERVICES_DIR" && docker compose --profile chaos down pumba 2>&1 | grep -v "^$")
echo "   Pumba stopped. llm-service delay removed."
echo ""

# ─── STEP 6: Print summary ────────────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  CHAOS TEST RESULTS SUMMARY"
echo "══════════════════════════════════════════════════════════"

python3 - <<'PYEOF'
import json, sys, os

results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results") if False else "./results"

def load(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as e:
        print(f"  ⚠️  Could not load {path}: {e}")
        return None

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

chaos  = load(f"{results_dir}/results-chaos.json")
normal = load(f"{results_dir}/results-microservices.json")

if not chaos:
    print("  No chaos result file found.")
    sys.exit(0)

rows = [
    ("http_req_duration", "avg",   "ms", "Avg latency"),
    ("http_req_duration", "p(95)", "ms", "p95 latency"),
    ("http_req_duration", "max",   "ms", "Max latency"),
    ("http_req_failed",   "rate",  "%",  "Error rate"),
    ("iterations",        "count", None, "Iterations"),
    ("http_reqs",         "count", None, "HTTP requests"),
]

header = f"\n  {'Metric':<22} {'Chaos (LLM delay)':<20}"
if normal:
    header += f" {'Baseline (normal)':<20}"
print(header)
print(f"  {'-'*22} {'-'*20}" + (f" {'-'*20}" if normal else ""))

for key, stat, unit, label in rows:
    cv = m(chaos, key, stat)
    nv = m(normal, key, stat) if normal else None

    if unit == "ms":
        c_fmt = fmt(cv, "ms") if cv is not None else "n/a"
        n_fmt = fmt(nv, "ms") if nv is not None else "n/a"
    elif unit == "%":
        c_fmt = f"{(cv or 0)*100:.1f}%"
        n_fmt = f"{(nv or 0)*100:.1f}%" if nv is not None else "n/a"
    else:
        c_fmt = str(int(cv)) if cv is not None else "n/a"
        n_fmt = str(int(nv)) if nv is not None else "n/a"

    row = f"  {label:<22} {c_fmt:<20}"
    if normal:
        row += f" {n_fmt:<20}"
    print(row)

print("")
PYEOF

echo "Files saved:"
echo "  JSON  → $RESULTS_DIR/results-chaos.json"
[ -f "$RESULTS_DIR/grafana-chaos-snapshot.png" ] && echo "  PNG   → $RESULTS_DIR/grafana-chaos-snapshot.png"
echo ""
echo "Grafana dashboard (for manual screenshot):"
echo "  $GRAFANA_URL"
echo ""
