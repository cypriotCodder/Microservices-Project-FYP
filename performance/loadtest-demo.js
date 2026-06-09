// ─── loadtest-demo.js ──────────────────────────────────────────────────────────
// Lightweight, write-heavy demo script for live presentations.
// Runs ~1 minute with 150 VUs max. Both architectures run IN PARALLEL.
// NO LLM calls — avoids Groq rate limits that ruin demos.
// Heavy writes (comments, orders, reviews) to expose the monolith's
// synchronous DB bottleneck vs microservices' async RabbitMQ pipeline.
// ────────────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const ARCH = __ENV.ARCH || 'unknown';
const VU_USERNAME = () => `user${(__VU - 1) % 50}@test.com`;
const VU_PASSWORD = 'password123';

export const options = {
    stages: [
        { duration: '10s', target: 25  },  // warm up
        { duration: '15s', target: 150 },  // ramp to peak
        { duration: '30s', target: 150 },  // hold — divergence builds here
        { duration: '5s',  target: 0   },  // cool down
    ],
    thresholds: {
        'http_req_duration{arch:microservices}': [
            { threshold: 'p(95)<1000', abortOnFail: false },
        ],
        'http_req_duration{arch:monolith}': [
            { threshold: 'p(95)<30000', abortOnFail: false },
        ],
    },
    http: {
        timeout: '15s',  // slightly generous — avoids false timeouts from shared hardware
    },
};

// ─── setup() ──────────────────────────────────────────────────────────────────
export function setup() {
    const TARGET = __ENV.TARGET_URL || 'http://host.docker.internal:8080';

    if (ARCH === 'unknown') {
        console.warn('[setup] WARNING: ARCH env var not set.');
    }

    const res = http.get(`${TARGET}/products`, { timeout: '30s' });
    if (res.status !== 200) {
        fail(`setup() failed: GET /products returned ${res.status}. Seed the database first.`);
    }

    const body = JSON.parse(res.body);
    const dataArray = Array.isArray(body) ? body : (body.products || []);
    const ids = dataArray.map(p => String(p._id || p.id)).filter(Boolean);

    if (ids.length === 0) {
        fail(`setup() failed: GET /products returned an empty array. Seed the database first.`);
    }

    console.log(`[setup] arch=${ARCH} | target=${TARGET} | ${ids.length} product IDs`);
    return { TARGET, ids, arch: ARCH };
}

// ─── VU-level session state ───────────────────────────────────────────────────
let vToken = null;
let vUserId = null;

// ─── default() ────────────────────────────────────────────────────────────────
export default function (data) {
    const { TARGET, ids, arch } = data;
    const randomProduct = ids[randomIntBetween(0, ids.length - 1)];

    // ── Per-VU login (first iteration only) ──────────────────────────────────
    if (!vToken) {
        const loginPayload = JSON.stringify({ username: VU_USERNAME(), password: VU_PASSWORD });
        const loginRes = http.post(`${TARGET}/auth/login`, loginPayload, {
            timeout: '30s',
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'SessionLogin', arch }
        });

        check(loginRes, { 'session login ok': r => r.status === 200 });

        if (loginRes.status === 200) {
            const body = JSON.parse(loginRes.body);
            vToken = body.token;
            vUserId = String(body.userId);
        } else {
            vToken = '__failed__';
            vUserId = '1';
        }

        sleep(1);
        return;
    }

    if (vToken === '__failed__') {
        sleep(1);
        return;
    }

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vToken}`
    };

    const p = (name, extraHeaders = {}) => ({
        timeout: '15s',
        tags: { name, arch },
        headers: { ...authHeaders, ...extraHeaders }
    });

    // ── FetchCatalog — fires EVERY iteration ─────────────────────────────────
    let res = http.get(`${TARGET}/products`, p('FetchCatalog'));
    check(res, { 'catalog 200': r => r.status === 200 });

    // ── PostComment — fires EVERY iteration (key write bottleneck) ───────────
    const commentPayload = JSON.stringify({
        userId: vUserId,
        content: `k6 demo comment VU=${__VU} iter=${__ITER}`
    });
    res = http.post(
        `${TARGET}/products/${randomProduct}/comments`,
        commentPayload,
        p('PostComment')
    );
    check(res, { 'comment accepted (201|202)': r => r.status === 201 || r.status === 202 });

    // ── One supplementary request, chosen probabilistically ──────────────────
    // Write-heavy distribution to maximize architectural divergence:
    //   Monolith:       synchronous Postgres writes block the event loop
    //   Microservices:  async RabbitMQ + independent DB pools stay responsive
    const roll = Math.random();

    if (roll < 0.05) {
        // PublishProduct (5%) — catalog write + cache invalidation
        const prodPayload = JSON.stringify({
            name: `k6 Demo Product VU${__VU}`,
            price: 49.99,
            description: "Demo load test product.",
            stock: 100,
            category: "Load Test"
        });
        res = http.post(`${TARGET}/products`, prodPayload, p('PublishProduct'));
        check(res, { 'status is 201': r => r.status === 201 });

    } else if (roll < 0.25) {
        // PostReview (20%) — write with rating
        const reviewPayload = JSON.stringify({
            userId: vUserId,
            title: `k6 review VU=${__VU}`,
            content: `k6 demo review iter=${__ITER}`,
            rating: randomIntBetween(1, 5)
        });
        res = http.post(
            `${TARGET}/products/${randomProduct}/reviews`,
            reviewPayload,
            p('PostReview')
        );
        check(res, { 'review created (201)': r => r.status === 201 });

    } else if (roll < 0.35) {
        // PingDB (10%) — raw DB latency probe
        res = http.get(`${TARGET}/products/ping`, p('PingDB'));
        check(res, { 'ping ok': r => r.status === 200 });

    } else if (roll < 0.50) {
        // FetchProductDetails (15%)
        res = http.get(`${TARGET}/products/${randomProduct}`, p('FetchProductDetails'));
        check(res, { 'status is 200': r => r.status === 200 });

    } else if (roll < 0.60) {
        // FetchOrders (10%)
        res = http.get(`${TARGET}/orders/${vUserId}`, p('FetchOrders'));
        check(res, { 'status is 200': r => r.status === 200 });

    } else if (roll < 0.75) {
        // AuthRegister (15%) — bcrypt CPU stress
        const regPayload = JSON.stringify({ username: `k6_${randomString(10)}`, password: 'password123' });
        res = http.post(`${TARGET}/auth/register`, regPayload,
            p('AuthRegister', { 'Content-Type': 'application/json' })
        );
        check(res, { 'status is 201': r => r.status === 201 });

    } else {
        // CreateOrder (25%) — write + stock decrement + cache invalidation
        // This is the else block so it absorbs all remaining probability.
        // Multi-step DB operation that saturates the monolith's connection pool.
        const orderPayload = JSON.stringify({
            userId: vUserId,
            totalAmount: 99.99,
            products: [{ productId: randomProduct, quantity: 1 }]
        });
        res = http.post(`${TARGET}/orders`, orderPayload, p('CreateOrder'));
        check(res, { 'status is 201': r => r.status === 201 });
    }

    // Aggressive think time — 0.5s keeps 150 VUs saturating the connection
    // pool (max=5) within the 30-second hold window.
    sleep(0.5);
}

// ─── teardown() ───────────────────────────────────────────────────────────────
export function teardown(data) {
    const { TARGET, arch } = data;

    console.log(`[teardown] arch=${arch} — deleting k6 test comments from ${TARGET}...`);

    const res = http.del(
        `${TARGET}/products/comments/k6`,
        null,
        { timeout: '30s' }
    );

    if (res.status === 200) {
        console.log(`[teardown] ✅ ${JSON.parse(res.body).message}`);
    } else {
        console.warn(`[teardown] ⚠️  Cleanup returned ${res.status}: ${res.body}`);
    }
}
