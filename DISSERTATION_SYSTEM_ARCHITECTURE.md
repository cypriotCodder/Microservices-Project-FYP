# Dissertation System Architecture Guide

> **Note to AI Agents & Researchers:** This document provides a high-level, clear, and comprehensive breakdown of the technical systems built for this dissertation. The core objective of this project is to empirically compare a **Monolithic Architecture** against a **Distributed Microservices Architecture** under extreme load, using an e-commerce platform as the test vehicle.

---

## 1. Project Overview

We have built a fully functional e-commerce platform twice. Both platforms share the exact same functional requirements (Users can register, browse products, add comments, purchase items, and receive LLM-generated product descriptions). 

The dissertation compares how the underlying architectural design affects **Performance**, **Resilience**, and **Scalability** when subjected to extreme high-throughput load testing.

---

## 2. Technology Stack

This project leverages a modern, full-stack, cloud-native ecosystem:
*   **Languages & Frameworks:** TypeScript, Node.js, Express.js, React.js (Vite)
*   **Relational Database & ORM:** PostgreSQL, Prisma ORM
*   **NoSQL Database:** MongoDB, Mongoose
*   **Caching & Message Broker:** Redis, RabbitMQ
*   **Observability & Tracing:** OpenTelemetry, Jaeger UI
*   **Load Testing & Metrics:** k6, InfluxDB, Grafana
*   **Containerization & Orchestration:** Docker, Docker Compose
*   **External Integrations:** Groq Cloud API (Llama-3 model)
*   **Chaos Engineering:** Pumba (Network Emulation)

---

## 3. System 1: The Monolithic Architecture

The Monolith represents traditional, tightly-coupled software design where all business logic runs in a single process.

### Core Components
*   **Backend Server:** A single Node.js (Express) application containing all routing, business logic, and integrations.
*   **Database:** A single PostgreSQL relational database (`monolith_db`) managed via Prisma ORM. Every table (Users, Products, Orders, Comments) lives together.
*   **Caching:** A centralized Redis instance used to cache the product catalog and debounce heavy database aggregations.
*   **Execution Flow:** Entirely synchronous. If a user asks the system to generate a product using the external Groq Llama3 AI API, the entire server thread waits for the API to respond before finalizing the request.

### Known Bottlenecks (For Dissertation Analysis)
Because everything shares a single Postgres Connection Pool (maximum 100 connections), extreme traffic spikes cause **Connection Starvation**. Complex queries (like the Admin Dashboard aggregates) or slow external API calls will block the event loop, causing subsequent user requests to timeout and fail (500 Internal Server Errors).

---

## 4. System 2: The Distributed Microservices Architecture

The Microservices system breaks the e-commerce platform down into isolated, independent, and specialized services.

### Core Components
*   **API Gateway:** The central entry point for all frontend traffic. It handles routing, authorization, distributed tracing initiation, and enforces **Circuit Breakers** (to protect the system if a downstream service fails).
*   **Service Mesh:** 
    *   `auth-service` (Manages Users & JWTs)
    *   `product-service` (Manages Catalog & Comments)
    *   `order-service` (Manages Checkout)
    *   `recommendation-service` (Generates User Suggestions)
    *   `llm-service` (Dedicated proxy to external AI APIs)
    *   `content-creator` (Generates mock data/products internally)
*   **Polyglot Persistence (Databases):** Unlike the monolith, databases are decentralized based on need. The `auth-service` uses PostgreSQL (for strict relational integrity), while the `product-service` and `order-service` use MongoDB (for document flexibility and speed).
*   **Asynchronous Messaging (RabbitMQ):** Used to decouple heavy write operations. For example, when a user posts a comment, the API Gateway drops the payload into a RabbitMQ message queue and immediately returns a `202 Accepted` to the user. The `product-service` consumes the message and writes it to the database asynchronously, completely eliminating database locking under high load.

### Resilience & Scalability Features (For Dissertation Analysis)
*   **Horizontal Pod Auto-Scaling (HPAS):** The `recommendation-service` is statically scaled to 3 replicated containers. Docker's internal DNS handles round-robin load balancing natively.
*   **Circuit Breaking:** If the `llm-service` experiences a severe delay, the API Gateway circuit breaker "trips" and returns a generic fallback response instantly, saving the rest of the system from cascading network failure.
*   **Distributed Tracing:** Implemented natively using **OpenTelemetry** and visualized via the Jaeger UI. It traces a single HTTP request as it hops across multiple microservices.
*   **Chaos Engineering:** An integrated `Pumba` container is used to intentionally sabotage network traffic. When activated, it injects a 5000ms (5-second) latency delay specifically into the `llm-service` to empirically prove that the API Gateway circuit breakers can isolate the failure.

---

## 5. The Testing Framework

To scientifically compare these two architectures, we utilize a highly deterministic, probabilistic testing methodology.

*   **Load Generator:** `k6` (an open-source load testing tool).
*   **Virtual Users (VU):** The script spawns up to 300 concurrent VUs. Each VU logs in natively, pulls a JWT token, and enters an infinite loop of reading the catalog and posting comments.
*   **Probabilistic Entropy:** To simulate organic human traffic, the VUs roll a mathematical dice on every loop iteration to trigger random actions (10% chance to register a new user, 15% chance to trigger an LLM summary, 20% chance to buy a product).
*   **Telemetry Pipeline:** All real-time metrics (Latency, Throughput, HTTP Error Rates) are streamed directly from `k6` into a time-series **InfluxDB** database.
*   **Visualization:** **Grafana** is actively hooked into InfluxDB to plot the comparative degradation curves.

### The Expected Dissertation Conclusion
Under nominal load, both architectures perform identically. However, under the 300 VU stress test, the Monolith will experience cascading failures (connection exhaustion), while the Microservices architecture will sustain throughput via RabbitMQ async messaging, independent database scaling, and Circuit Breaker isolation.
