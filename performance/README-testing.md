# Performance Load Testing Guide

This directory contains the core `k6` load testing framework used to stress-test and empirically compare the performance of the Monolith architecture against the Microservices architecture. 

The test script (`loadtest.js`) runs a highly realistic, non-linear traffic simulation that mirrors an active e-commerce event (like Black Friday). It automatically reports all metrics to the InfluxDB instance, which allows Grafana to visualize the architecture's latency, throughput, and degradation curve.

---

## 1. How to Run the Load Test

You need to execute the script using `k6`, providing the architectural target and the base URL environment variables.

### Testing the Microservices Architecture:
```bash
k6 run \
  -e TARGET_URL=http://localhost:8080 \
  -e ARCH=microservices \
  performance/loadtest.js
```

### Testing the Monolith Architecture:
```bash
k6 run \
  -e TARGET_URL=http://localhost:4000 \
  -e ARCH=monolith \
  performance/loadtest.js
```

### Analyzing the Results:
Once the test starts, the terminal will print real-time statistics. However, for deep architectural analysis, navigate to the Grafana dashboard:
**URL:** `http://localhost:3000`
**Default Login:** `admin` / `admin`

---

## 2. What Exactly Does a Virtual User (VU) Do?

A **Virtual User (VU)** in `k6` is an isolated parallel execution thread that acts like a real human interacting with the application. Over the course of the load test, `k6` will ramp up from 25 to 300 concurrent Virtual Users simultaneously slamming the system.

During its lifecycle, each VU performs the following actions:

### Phase 1: Authentication (Once Per VU)
When a VU first spawns, it randomly selects one of the 50 seeded test accounts (e.g., `user24@test.com`). It sends a `POST /auth/login` request. The backend server must execute a computationally expensive `bcrypt` password comparison to authenticate the VU. The VU then saves the returned JWT token to its local thread memory for all future requests.

### Phase 2: Core Loop (Repeats Continuously)
After logging in, the VU enters a continuous high-speed loop. On **every single loop iteration**, the VU natively executes:
1. **Fetch Catalog (`GET /products`):** A heavy read request testing the system's ability to pull and transmit the primary product database (and testing the Redis Cache).
2. **Post Comment (`POST /products/:id/comments`):** A guaranteed write request to a random product. This forces the Monolith to block the main thread waiting for Postgres, while the Microservices architecture drops the comment into RabbitMQ for asynchronous processing.

### Phase 3: Probabilistic Actions
After fetching the catalog and posting a comment, the VU rolls a mathematical "dice" to perform **one** supplementary action before restarting the loop. This mirrors random user behavior:

*   **10% Chance: Publish Product (`POST /products`)** - Forces a full invalidation of the Redis product cache.
*   **15% Chance: Ping Database (`GET /products/ping`)** - Bypasses the cache to probe raw database indexing latency.
*   **15% Chance: Fetch Product Details (`GET /products/:id`)** - Fetches specific data for a single item.
*   **15% Chance: Fetch Orders (`GET /orders/:userId`)** - A complex database join combining User ID with their Order History.
*   **10% Chance: Register User (`POST /auth/register`)** - Forces the server CPU to generate a brand new `bcrypt` hash for a random account.
*   **15% Chance: LLM Summarize (`POST /llm/summarize`)** - Triggers a real external API call to the Groq Llama3 model, testing how the architecture handles external network bottlenecks.
*   **10% Chance: Create Content (`POST /content/generate-product`)** - Triggers cross-service communication (or internal generation) to dynamically craft LLM-based product models on the fly.
*   **10% Chance: Create Order (`POST /orders`)** - Triggers the payment processing, inventory decrement logic, and multi-table transactional commits.

This combination of reads, writes, and CPU-intensive mathematical generation provides an extremely robust simulation of organic application strain.
