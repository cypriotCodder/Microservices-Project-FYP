# MicroShop — Monolith vs Microservices

A final-year dissertation project implementing the same e-commerce system twice: a **Node.js/Express monolith** and a **distributed microservices application**. The project explores how architectural choices affect performance, resilience, and scalability through load testing, distributed tracing, and controlled failure injection.

## Overview

Both implementations target the same shopping workflows: account registration and login, product browsing, comments and reviews, orders, recommendations, and AI-assisted content. React/Vite clients provide storefront and administration views. The engineering focus is the backend comparison: service boundaries, persistence, caching, asynchronous messaging, and failure handling.

## Research question / comparison goal

**How do a monolith and a distributed implementation of the same e-commerce workload behave as demand increases or a downstream dependency slows down?**

The experiment examines request latency, throughput, HTTP failures, and recovery behavior. These implementations also differ in database technology and synchronous versus queued writes, so results cannot isolate service decomposition alone. Scalability is a research goal; the checked-in Compose configuration does not implement autoscaling or replicated recommendation containers.

## Architecture

| | Monolith | Microservices |
|---|---|---|
| Request path | React → one Express backend | React → API gateway → domain services |
| Persistence | PostgreSQL through Prisma | PostgreSQL/Prisma for auth and recommendations; MongoDB/Mongoose for products and orders |
| Cache | Redis | Redis in the product service |
| Writes | In-process routes and database calls | HTTP plus RabbitMQ events for comments and order-related stock updates |
| Failure handling | Shared backend process | Gateway circuit breakers with selected fallback responses |

[Monolith diagram](diagrams/monolith.jpeg) · [Microservices diagram](diagrams/microservices.jpeg) · [Sequence diagram](diagrams/sequence.jpeg) — editable Mermaid sources are in [diagrams/](diagrams/).

The [architecture guide](DISSERTATION_SYSTEM_ARCHITECTURE.md) records the dissertation design. Some descriptions there are hypotheses or earlier configurations; the code and Compose files define the current implementation. Awaiting network I/O does not itself block the Node.js event loop, and queued writes do not guarantee that database contention disappears.

## Service breakdown

| Component | Responsibility |
|---|---|
| `api-gateway` | HTTP routing, JWT middleware, circuit breakers, and admin aggregation |
| `auth-service` | Registration, bcrypt password hashing, JWT issuance, and user data |
| `product-service` | Catalog, comments/reviews, Redis caching, and RabbitMQ consumers |
| `order-service` | Order persistence and order events consumed for stock updates |
| `recommendation-service` | Recommendation endpoints backed by PostgreSQL/Prisma |
| `llm-service` | Groq API integration using `llama-3.1-8b-instant` for text generation and summaries |
| `content-creator` | Product-content generation through downstream services |
| `traffic-service` | Application-level traffic simulation; separate from the k6 suite |

The monolith contains the corresponding business routes within one backend. A separate `traffic-generator` directory also exists, but is not started by the current Compose file.

## Key engineering features

- **Two implementations of a shared domain:** exposes the tradeoffs between local calls and network boundaries.
- **Authentication and authorization:** JWT sessions, bcrypt password hashing, and admin middleware.
- **Polyglot persistence:** relational schemas alongside MongoDB documents managed with Mongoose.
- **Caching and asynchronous work:** Redis catalog caching and invalidation; RabbitMQ comment processing and order events. An accepted queued comment is not the same as a completed database write.
- **External AI integration:** Groq/Llama generation with dedicated microservice routing and fallback handling.
- **Containerized development:** Docker Compose stacks for each application and the performance tools.

## Observability and resilience

OpenTelemetry instrumentation is present in the gateway and core microservices, exporting to **Jaeger** when `OTEL_ENABLED=true` is set in their environments. The default exporter endpoint is `http://jaeger:4318/v1/traces`. Tracing is opt-in, not automatically enabled merely by starting Jaeger.

The gateway implements circuit breakers, including fallback responses for recommendations and LLM requests. **Pumba** is behind the optional `chaos` profile and is configured to inject **5 seconds of network delay for 5 minutes** into matching LLM containers. This provides a failure-injection scenario, not proof that every failure is isolated.

**k6 → InfluxDB → Grafana** supplies load-test metrics and dashboards; Telegraf configuration is also included. Inspect response checks and fallback behavior alongside latency: a quick fallback is not necessarily a successful business operation.

## Performance / load-testing methodology

The current [load script](performance/loadtest.js) ramps through **25, 100, 250, 400, and 500 virtual users**, then back to zero, over five minutes of configured stages. Each user authenticates using a seeded account, repeatedly reads the catalog and posts a comment, and selects additional actions such as reviews, registration, orders, and LLM requests. Randomized actions and external API latency mean runs are not deterministic.

[Saved JSON summaries](performance/results/) include monolith, microservices, demo, and chaos runs. They are useful raw artifacts, but are not presented here as a controlled benchmark or evidence of a universal winner. A reproducible comparison needs the commit, machine/container resources, dataset, cache state, external API conditions, repeated runs, and equivalent success criteria recorded together. The current script uses different latency thresholds for each architecture; threshold pass/fail alone is not a fair comparison.

For a fresh comparison, seed both systems, use comparable data and resource budgets, run each target separately, record latency percentiles/throughput/failures, then repeat with chaos enabled. Account for queue drain time and completed writes when comparing asynchronous and synchronous operations.

The [testing guide](performance/README-testing.md) and [runbook](RUNBOOK.md) provide background. Their older 300-VU descriptions and machine-specific wrapper commands should not override the current script.

## How to run it

Prerequisites: **Docker with Compose v2**, available ports below, and a Groq API key for live LLM calls. These are local research/demo configurations, with development credentials and exposed infrastructure ports; they are not a hardened deployment.

```bash
git clone https://github.com/cypriotCodder/Microservices-Project-FYP.git
cd Microservices-Project-FYP
```

Before starting, copy the examples from the repository root. These paths match the
`env_file` entries resolved relative to each Compose file:

```bash
cp -n monolith/backend/.env.example monolith/backend/.env
cp -n microservices/api-gateway/.env.example microservices/api-gateway/.env
cp -n microservices/services/auth-service/.env.example microservices/services/auth-service/.env
cp -n microservices/services/product-service/.env.example microservices/services/product-service/.env
cp -n microservices/services/order-service/.env.example microservices/services/order-service/.env
cp -n microservices/services/llm-service/.env.example microservices/services/llm-service/.env
cp -n microservices/services/recommendation-service/.env.example microservices/services/recommendation-service/.env
```

The `-n` option preserves existing local files. Real `.env` and `.env.*` files are
ignored by Git; only `.env.example` and `.env.sample` files should be committed.
For an existing checkout, back up any locally customized `.env` files before pulling
this cleanup, then restore them if Git removes the formerly tracked copies.

1. Set `GROQ_API_KEY` in `monolith/backend/.env` and
   `microservices/services/llm-service/.env` to your own key for live LLM calls.
   The example value is a placeholder and cannot authenticate to Groq.
2. Compose's explicit `environment` entries override values in `env_file`, including
   database URLs. The database passwords in the examples are placeholders; the
   unchanged Compose files supply the existing local database credentials. When
   running a service directly on the host, adjust its `.env` to the actual database
   password and published host port (PostgreSQL: `5432` for microservices, `5433` for
   the monolith), and replace container hostnames with reachable addresses.
3. The recommendation example contains comments only: Compose supplies its
   `DATABASE_URL`, but still requires the `.env` file to exist. Its Prisma
   recommendation schema may also need initialization; the service startup command
   does not run migrations.
4. The monolith example uses the existing development JWT default. The auth service
   and gateway also fall back to that default; if setting `JWT_SECRET` explicitly,
   keep token issuers and verifiers consistent (set the same value in both auth
   service and gateway `.env` files).
5. If you want tracing, add `OTEL_ENABLED=true` to the gateway/core-service
   environment files before building and starting them.

Run these from the repository root:

```bash
docker compose -f microservices/docker-compose.yml up -d --build
docker compose -f monolith/docker-compose.yml up -d --build
docker compose -f performance/docker-compose.yml up -d
```

| Interface | Local URL |
|---|---|
| Microservices storefront / gateway | http://localhost:5178 / http://localhost:8080 |
| Monolith storefront / API | http://localhost:5174 / http://localhost:4000 |
| Jaeger | http://localhost:16686 |
| Grafana | http://localhost:3000 |
| RabbitMQ management | http://localhost:15672 |

After services are ready, seed test users through `POST /auth/seed-users` on each API. Check `GET /products` for a populated catalog. The runbook lists product-seeding routes; the gateway requires a valid bearer token for product POST requests, including seeding. Use an authenticated session when needed.

To run k6 against the microservices stack and stream metrics to InfluxDB:

```bash
docker compose -f performance/docker-compose.yml run --rm \
  -e ARCH=microservices -e TARGET_URL=http://host.docker.internal:8080 \
  k6 run --tag arch=microservices \
  --summary-export=/results/results-local-microservices.json /scripts/loadtest.js
```

For the monolith, replace `microservices` with `monolith` in the architecture tag/output filename and use port `4000`. `host.docker.internal` is intended for Docker Desktop; Linux hosts need a reachable host address or host-gateway configuration. Tests write data and may call the external Groq API. The wrapper scripts contain author-specific paths, so use the explicit command above on a fresh checkout.

Optional chaos experiment:

```bash
docker compose -f microservices/docker-compose.yml --profile chaos up -d pumba
```

Pumba requires access to the Docker socket and compatible network-emulation support. To stop an application while retaining its data, use `docker compose -f <compose-file> down`; adding `-v` deletes its persistent volumes.

## Repository structure

```text
monolith/          Express backend, Prisma schema, React client, Compose stack
microservices/     Gateway, domain services, React client, telemetry, Compose stack
performance/       k6 scripts, saved results, Grafana dashboards, InfluxDB stack
diagrams/          Architecture/sequence images and editable Mermaid sources
tools/seeder/      Database-seeding utility
```

Further reading: [Architecture](DISSERTATION_SYSTEM_ARCHITECTURE.md) · [Technology notes](TECHNOLOGIES_USED.md) · [Runbook](RUNBOOK.md) · [Load testing](performance/README-testing.md).

## Tech stack

**Application:** TypeScript, Node.js, Express, React, Vite, Tailwind CSS, Recharts.

**Data and messaging:** PostgreSQL, Prisma, MongoDB, Mongoose, Redis, RabbitMQ.

**Authentication:** JWT, bcrypt.

**Infrastructure and experiments:** Docker Compose, OpenTelemetry, Jaeger, k6, InfluxDB, Grafana, Telegraf, Pumba.

**AI integration:** Groq API, Llama 3.1.
