# FYP Project Runbook

A living reference for starting, stopping, testing, and inspecting every component in the Monolith vs Microservices experiment.

> **Note:** All `docker-compose` commands below assume you are in the project root directory:
> `/Users/nedim/Desktop/myRepo/FYP/deneme1`

---

## 1. Starting the Systems

### Microservices Architecture
```bash
cd microservices
docker-compose up -d --build
```
This boots **all** services: API Gateway, Auth, Product, Order, Recommendation, LLM, Content Creator, Traffic, RabbitMQ, MongoDB, Postgres, Redis, Telegraf, and Jaeger.

| Component         | Local URL                        |
|-------------------|----------------------------------|
| API Gateway       | http://localhost:8080            |
| Frontend (Vite)   | http://localhost:5178            |
| RabbitMQ Admin    | http://localhost:15672           |
| Jaeger Tracing UI | http://localhost:16686           |

### Monolith Architecture
```bash
cd monolith
docker-compose up -d --build
```

| Component         | Local URL                        |
|-------------------|----------------------------------|
| Backend API       | http://localhost:4000             |
| Frontend (Vite)   | http://localhost:5174             |

---

## 2. Stopping the Systems

```bash
# Microservices
cd microservices && docker-compose down

# Monolith
cd monolith && docker-compose down
```

Add `-v` to also wipe persistent volumes (databases, caches):
```bash
docker-compose down -v
```

---

## 3. Rebuilding a Single Service

If you changed code in only one service, rebuild just that container:
```bash
cd microservices
docker-compose up -d --build api-gateway        # or product-service, order-service, etc.
```

---

## 4. Seeding the Database

### Microservices
```bash
# Seed products (via the API Gateway)
curl -X POST http://localhost:8080/products/seed

# Seed test users for load testing (50 accounts)
curl -X POST http://localhost:8080/auth/seed-users
```

### Monolith
```bash
# Seed products
curl -X POST http://localhost:4000/seed

# Seed test users for load testing
curl -X POST http://localhost:4000/auth/seed-users
```

---

## 5. Running the Grafana Stress Test (k6)

### Prerequisites
1. Make sure the **Performance stack** (Grafana + InfluxDB + k6) is running:
   ```bash
   cd performance
   docker-compose up -d
   ```
2. Make sure **both** the Microservices and Monolith stacks are running.
3. Databases must be seeded (see Section 4 above).

### Run the Full Automated Suite
The script runs the k6 test against Microservices first, then Monolith, and prints a summary:
```bash
cd performance
./run-tests.sh
```

### View Live Results in Grafana
Open **http://localhost:3000** in your browser while the tests are running to watch real-time latency, throughput, and error-rate panels.

### JSON Results
After the test suite completes, find the raw JSON summaries at:
- `performance/results/results-microservices.json`
- `performance/results/results-monolith.json`

---

## 6. Viewing Distributed Traces (Jaeger)

> Requires the Microservices stack to be running (Jaeger is part of `microservices/docker-compose.yml`).

1. Generate some traffic — either browse the frontend, use curl, or run the k6 test.
2. Open **http://localhost:16686** in your browser.
3. In the left sidebar under **Search**, pick a service from the dropdown (e.g. `api-gateway`, `product-service`, `order-service`).
4. Click **Find Traces** to see waterfall diagrams showing exactly how many milliseconds each request spent inside each container and on the network.

---

## 7. Flushing Caches

If you need to clear the Redis cache (e.g. after changing product data):
```bash
# Microservices Redis
docker exec -it $(docker ps -qf "name=microservices.*redis") redis-cli FLUSHALL

# Monolith Redis
docker exec -it $(docker ps -qf "name=monolith.*redis") redis-cli FLUSHALL
```

---

## 8. Checking Container Logs

```bash
# Tail logs for a specific service
docker-compose -f microservices/docker-compose.yml logs -f api-gateway
docker-compose -f microservices/docker-compose.yml logs -f product-service

# Monolith backend logs
docker-compose -f monolith/docker-compose.yml logs -f monolith-backend
```

---

## 9. Health Checks

Quick sanity check that services are alive:
```bash
# Microservices Gateway
curl http://localhost:8080/health

# Monolith Backend
curl http://localhost:4000/health
```

---

## 10. Key Ports Reference

| Port  | Service                          | Stack          |
|-------|----------------------------------|----------------|
| 8080  | API Gateway                      | Microservices  |
| 5178  | Microservices Frontend (Vite)    | Microservices  |
| 3001  | Auth Service                     | Microservices  |
| 3002  | Product Service                  | Microservices  |
| 3003  | Order Service                    | Microservices  |
| 3004  | Recommendation Service           | Microservices  |
| 3005  | LLM Service                      | Microservices  |
| 3007  | Traffic Service                  | Microservices  |
| 3008  | Content Creator                  | Microservices  |
| 5672  | RabbitMQ (AMQP)                  | Microservices  |
| 15672 | RabbitMQ Management UI           | Microservices  |
| 27017 | MongoDB                          | Microservices  |
| 5432  | PostgreSQL                       | Microservices  |
| 6379  | Redis                            | Microservices  |
| 16686 | Jaeger Tracing UI                | Microservices  |
| 4318  | Jaeger OTLP Receiver             | Microservices  |
| 4000  | Monolith Backend                 | Monolith       |
| 5174  | Monolith Frontend (Vite)         | Monolith       |
| 6380  | Redis (mapped from 6379)         | Monolith       |
| 5433  | PostgreSQL (mapped from 5432)    | Monolith       |
| 3000  | Grafana Dashboard                | Performance    |
| 8086  | InfluxDB                         | Performance    |

---

## 11. Default Credentials

**Admin Account**
- **Email/Username**: `admin@fyp.com`
- **Password**: `admin`

**Admin Account Monolith**
- **Email/Username**: `admin@fyp.com`
- **Password**: `Admin@123`

These credentials can be used to log into the frontend applications (both Microservices and Monolith) to access administrative features.

---

## 12. Distributed Tracing (Observability)

To verify the microservices' network telemetry flows in real-time, navigate to your **Jaeger UI** instances:

1. Open a browser and visit: `http://localhost:16686`
2. Under "Service", you should actively identify traces mapped out for `api-gateway`, `order-service`, `product-service`, `auth-service`, `llm-service`, and `recommendation-service`.
3. Traces map the physical time packets spend moving through the bridged `docker-compose_default` network.

---

## 13. Chaos Engineering (Pumba)

The `Pumba` framework has been injected seamlessly into the Docker microservices configuration as a Chaos Agent to simulate artificial latency. By default, **Pumba will NOT execute under generic boot sequences**. 

### How to Execute a Chaos Load-Test:
To explicitly test the `api-gateway` circuit breaker against a broken microservices node (`llm-service`), you must run the Docker-Compose with the `chaos` profile explicitly attached.

```bash
cd microservices
docker-compose --profile chaos up -d --build
```
This forces Pumba into the active Docker socket array. It attaches a continuous `tc netem` 5,000-millisecond delay penalty exactly onto the `llm-service`'s network interface.
You can cross-reference the Jaeger traces or the Grafana UI under `k6` load and visually watch the API Gateway sever the delayed routes dynamically!

---

## 14. Pre-Presentation Checklist

> **Important:** Only the admin account (`admin@fyp.com`) is auto-seeded on every container start. The 50 k6 test users and products must be seeded **manually** after a fresh database. Users are never deleted by the application — they only disappear when the Postgres Docker volume is wiped (e.g. `docker-compose down -v`).

### Quick Start (Fresh or Existing)
```bash
# 1. Start the microservices stack (preserves data if volumes exist)
cd microservices
docker-compose up -d --build

# 2. Wait ~15 seconds for Postgres healthcheck + admin auto-seed

# 3. Seed test users (safe to re-run — uses upsert)
curl -X POST http://localhost:8080/auth/seed-users

# 4. Seed products (safe to re-run)
curl -X POST http://localhost:8080/products/seed

# 5. Start the monolith stack
cd ../monolith
docker-compose up -d --build

# 6. Seed monolith test users and products
curl -X POST http://localhost:4000/auth/seed-users
curl -X POST http://localhost:4000/seed
```

### Verify Everything Works
```bash
# Check user count (expect ≥ 51: 1 admin + 50 test users)
curl http://localhost:3001/admin/users/count

# Verify admin login (microservices)
curl -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@fyp.com","password":"admin"}'

# Verify admin login (monolith)
curl -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@fyp.com","password":"admin"}'

# Quick health checks
curl http://localhost:8080/health
curl http://localhost:4000/health
```

### Safe Stop vs Full Reset
```bash
# Safe stop — data survives for next demo
docker-compose down

# Full reset — destroys ALL data, must re-seed everything
docker-compose down -v
```

### If Users Are Missing
If `admin/users/count` returns only 1 (just the admin), re-seed:
```bash
curl -X POST http://localhost:8080/auth/seed-users
```

### Start the Performance Stack (for k6 demos)
```bash
cd performance
docker-compose up -d
# Then open Grafana at http://localhost:3000
```

---

## 15. Before Live Demo — Pre-Flight Checklist

> **Goal:** Run these commands **10–15 minutes before** your live demo so every service is warm, data is seeded, caches are clean, and Grafana starts with empty graphs. Copy-paste the blocks in order.

### Step 0 — Kill Everything (clean slate)
```bash
# Tear down all three stacks (order doesn't matter).
# -v wipes volumes so you start with zero stale data.
cd /Users/nedim/Desktop/myRepo/FYP/deneme1

(cd microservices && docker compose down -v) 2>/dev/null
(cd monolith     && docker compose down -v) 2>/dev/null
(cd performance  && docker compose down -v) 2>/dev/null

# Prune any orphan containers / dangling images (optional but safe)
docker container prune -f
docker image prune -f
```

### Step 1 — Start the Microservices Stack
```bash
cd /Users/nedim/Desktop/myRepo/FYP/deneme1/microservices
docker compose up -d --build
```

Wait **~20 seconds** for Postgres to pass its healthcheck and for the `seeder` container to auto-create the admin account.

### Step 2 — Start the Monolith Stack
```bash
cd /Users/nedim/Desktop/myRepo/FYP/deneme1/monolith
docker compose up -d --build
```

### Step 3 — Start the Performance / Grafana Stack
```bash
cd /Users/nedim/Desktop/myRepo/FYP/deneme1/performance
docker compose up -d
```

### Step 4 — Wait for Health
```bash
echo "⏳ Waiting for services..."
until curl -sf http://localhost:8080/health > /dev/null 2>&1; do sleep 2; done
echo "✅ Microservices API Gateway is UP"

until curl -sf http://localhost:4000/health > /dev/null 2>&1; do sleep 2; done
echo "✅ Monolith Backend is UP"

until curl -sf http://localhost:3000/api/health > /dev/null 2>&1; do sleep 2; done
echo "✅ Grafana is UP"
```

### Step 5 — Seed Data (both stacks)
```bash
# Microservices — test users + products
curl -s -X POST http://localhost:8080/auth/seed-users | jq .
curl -s -X POST http://localhost:8080/products/seed  | jq .

# Monolith — test users + products
curl -s -X POST http://localhost:4000/auth/seed-users | jq .
curl -s -X POST http://localhost:4000/seed            | jq .
```

### Step 6 — Verify Logins & Data
```bash
# Admin login — Microservices
curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@fyp.com","password":"admin"}' | jq .token

# Admin login — Monolith
curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin@fyp.com","password":"admin"}' | jq .token

# Test user login (proves k6 users are seeded)
curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user0@test.com","password":"password123"}' | jq .token

# User count (expect ≥ 51: 1 admin + 50 test users)
curl -s http://localhost:3001/admin/users/count | jq .

# Product count
curl -s http://localhost:8080/products | jq 'if type == "array" then length else .products | length end'
```

### Step 7 — Flush Caches & InfluxDB (clean graphs)
```bash
# Flush Redis on both stacks so cached responses don't mask real latency
docker exec -it $(docker ps -qf "name=microservices.*redis") redis-cli FLUSHALL
docker exec -it $(docker ps -qf "name=monolith.*redis")      redis-cli FLUSHALL

# Wipe previous k6 data from InfluxDB so Grafana starts with empty panels
curl -s -X POST 'http://localhost:8086/query?db=k6' \
  --data-urlencode 'q=DROP SERIES FROM /.*/' > /dev/null
echo "✅ InfluxDB k6 data wiped — Grafana panels are clean"
```

### Step 8 — Open Browser Tabs
Open these in separate tabs **before** the demo starts:

| Tab | URL | Purpose |
|-----|-----|---------|
| 1 | http://localhost:5178 | Microservices Frontend |
| 2 | http://localhost:5174 | Monolith Frontend |
| 3 | http://localhost:3000 | Grafana (k6 dashboard) |
| 4 | http://localhost:16686 | Jaeger Tracing UI |
| 5 | http://localhost:15672 | RabbitMQ Management (guest/guest) |

### Step 9 — Smoke Test (optional but recommended)
Run a quick single-user request to prove the entire flow works end-to-end:
```bash
# Login as test user, place an order, post a comment
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user0@test.com","password":"password123"}' | jq -r .token)

PRODUCT_ID=$(curl -s http://localhost:8080/products | jq -r '.[0]._id // .[0].id')

# Post a comment
curl -s -X POST "http://localhost:8080/products/${PRODUCT_ID}/comments" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"smoke","content":"Pre-demo smoke test"}' | jq .

# Place an order
curl -s -X POST http://localhost:8080/orders \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"smoke\",\"totalAmount\":9.99,\"products\":[{\"productId\":\"${PRODUCT_ID}\",\"quantity\":1}]}" | jq .

echo "✅ Smoke test passed — system is ready for demo"
```

### Step 10 — Run the Live Load Test (when ready)
When you're live and the audience is watching:
```bash
cd /Users/nedim/Desktop/myRepo/FYP/deneme1/performance
./run-demo.sh
```
Switch to the **Grafana tab** immediately — both curves appear in real-time.

### Quick Reference — One-Liner (Steps 1–7 combined)
For experienced runs where you just want to fire everything:
```bash
cd /Users/nedim/Desktop/myRepo/FYP/deneme1 && \
(cd microservices && docker compose down -v) 2>/dev/null; \
(cd monolith && docker compose down -v) 2>/dev/null; \
(cd performance && docker compose down -v) 2>/dev/null; \
(cd microservices && docker compose up -d --build) && \
(cd monolith && docker compose up -d --build) && \
(cd performance && docker compose up -d) && \
echo "⏳ Waiting..." && sleep 25 && \
curl -s -X POST http://localhost:8080/auth/seed-users > /dev/null && \
curl -s -X POST http://localhost:8080/products/seed > /dev/null && \
curl -s -X POST http://localhost:4000/auth/seed-users > /dev/null && \
curl -s -X POST http://localhost:4000/seed > /dev/null && \
docker exec $(docker ps -qf "name=microservices.*redis") redis-cli FLUSHALL > /dev/null && \
docker exec $(docker ps -qf "name=monolith.*redis") redis-cli FLUSHALL > /dev/null && \
curl -s -X POST 'http://localhost:8086/query?db=k6' --data-urlencode 'q=DROP SERIES FROM /.*/' > /dev/null && \
echo "✅ All systems GO — open browser tabs and run ./run-demo.sh"
```
