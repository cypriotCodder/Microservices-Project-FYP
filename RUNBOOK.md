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
| API Gateway       | http://localhost:8080             |
| Frontend (Vite)   | http://localhost:5178             |
| RabbitMQ Admin    | http://localhost:15672            |
| Jaeger Tracing UI | http://localhost:16686            |

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

These credentials can be used to log into the frontend applications (both Microservices and Monolith) to access administrative features.
