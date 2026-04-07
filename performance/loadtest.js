import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ─── Runtime constants ─────────────────────────────────────────────────────────
// ARCH is injected via -e ARCH=microservices  (or -e ARCH=monolith).
// It is also applied globally via --tag arch=microservices so InfluxDB gets the
// tag on every metric even if the per-request tags below are somehow skipped.
// Having it in both places is intentional: the per-request tag makes the Grafana
// GROUP BY "name", "arch" endpoint table work correctly.
const ARCH          = __ENV.ARCH          || 'unknown';
const SAMPLE_USER_ID = '1';

export const options = {
    stages: [
        { duration: '30s', target: 50   }, // warm up
        { duration: '1m',  target: 200  }, // normal load
        { duration: '1m',  target: 500  }, // moderate stress
        { duration: '1m',  target: 1000 }, // heavy stress
        { duration: '30s', target: 0    }, // cool down
    ],
    // Thresholds omitted deliberately: let the Monolith degrade without aborting.
    // Failure thresholds are observed in Grafana via arch tag segmentation.
};

// ─── setup() runs ONCE before VUs start ───────────────────────────────────────
// Fetches real product IDs from the live target (works for both Postgres integer
// IDs returned by the monolith and MongoDB ObjectIDs returned by the microservices).
export function setup() {
    const TARGET = __ENV.TARGET_URL || 'http://host.docker.internal:8080';

    // Guard: fail loudly if ARCH was not passed so the operator knows immediately.
    if (ARCH === 'unknown') {
        console.warn('[setup] WARNING: ARCH env var not set. ' +
                     'Pass -e ARCH=microservices or -e ARCH=monolith. ' +
                     'Grafana arch-split panels will show "unknown".');
    }

    const res = http.get(`${TARGET}/products`);
    if (res.status !== 200) {
        fail(`setup() failed: GET /products returned ${res.status}. ` +
             `Seed the database first:\n` +
             `  Monolith:      curl -X POST ${TARGET}/seed\n` +
             `  Microservices: curl -X POST ${TARGET}/products/seed`);
    }

    const body = JSON.parse(res.body);
    // Both architectures return an array.
    // Monolith (Postgres)  → integer id field  e.g. 1, 2, 3
    // Microservices (Mongo) → string _id field e.g. "65bf73e934..."
    const ids = body.map(p => String(p._id || p.id)).filter(Boolean);

    if (ids.length === 0) {
        fail(`setup() failed: GET /products returned an empty array. ` +
             `Seed the database first:\n` +
             `  Monolith:      curl -X POST ${TARGET}/seed\n` +
             `  Microservices: curl -X POST ${TARGET}/products/seed`);
    }

    console.log(`[setup] arch=${ARCH} | target=${TARGET} | ` +
                `${ids.length} product IDs: ${ids.join(', ')}`);
    return { TARGET, ids, arch: ARCH };
}

// ─── default() receives setup() data as first argument ────────────────────────
export default function (data) {
    const { TARGET, ids, arch } = data;
    const randomProduct = ids[randomIntBetween(0, ids.length - 1)];
    const roll = Math.random();
    let res;

    if (roll < 0.25) {
        // Fetch Catalog (25%)
        res = http.get(`${TARGET}/products`, {
            tags: { name: 'FetchCatalog', arch }
        });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.40) {
        // Product Details (15%)
        res = http.get(`${TARGET}/products/${randomProduct}`, {
            tags: { name: 'FetchProductDetails', arch }
        });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.55) {
        // Post Comment — write-heavy stress target (15%)
        const payload = JSON.stringify({
            userId: SAMPLE_USER_ID,
            content: `k6 stress comment VU=${__VU} iter=${__ITER}`
        });
        res = http.post(
            `${TARGET}/products/${randomProduct}/comments`,
            payload,
            { headers: { 'Content-Type': 'application/json' }, tags: { name: 'PostComment', arch } }
        );
        check(res, { 'comment accepted (201|202)': (r) => r.status === 201 || r.status === 202 });

    } else if (roll < 0.60) {
        // Register new user (5%)
        const payload = JSON.stringify({ username: `k6_${randomString(10)}`, password: 'password123' });
        res = http.post(`${TARGET}/auth/register`, payload, {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'AuthRegister', arch }
        });
        check(res, { 'status is 201': (r) => r.status === 201 });

    } else if (roll < 0.70) {
        // Admin login — bcrypt CPU stress (10%)
        const payload = JSON.stringify({ username: 'admin@fyp.com', password: 'admin' });
        res = http.post(`${TARGET}/auth/login`, payload, {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'AuthLogin', arch }
        });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.80) {
        // LLM summarize (10%)
        const payload = JSON.stringify({ text: 'A standard k6 generated e-commerce item.' });
        res = http.post(`${TARGET}/llm/summarize`, payload, {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'LLMSummarize', arch }
        });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.90) {
        // Fetch Orders (10%)
        res = http.get(`${TARGET}/orders`, {
            tags: { name: 'FetchOrders', arch }
        });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else {
        // Checkout (10%)
        const payload = JSON.stringify({
            userId: SAMPLE_USER_ID,
            totalAmount: 99.99,
            products: [{ productId: randomProduct, quantity: 1 }]
        });
        res = http.post(`${TARGET}/orders`, payload, {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'CreateOrder', arch }
        });
        check(res, { 'status is 201': (r) => r.status === 201 });
    }

    sleep(0.1);
}
