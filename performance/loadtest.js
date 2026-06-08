import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ─── Runtime constants ─────────────────────────────────────────────────────────
// ARCH is injected via -e ARCH=microservices  (or -e ARCH=monolith).
// It is also applied globally via --tag arch=microservices so InfluxDB gets the
// tag on every metric even if the per-request tags below are somehow skipped.
// Having it in both places is intentional: the per-request tag makes the Grafana
// GROUP BY "name", "arch" endpoint table work correctly.
const ARCH = __ENV.ARCH || 'unknown';
// 50 test accounts seeded by prisma/seedUsers.ts / microservices/seedUsers.ts
// Each VU gets its own account so bcrypt hits 50 separate rows under load.
const VU_USERNAME = () => `user${(__VU - 1) % 50}@test.com`;
const VU_PASSWORD = 'password123';

export const options = {
    /*stages: [
        { duration: '30s', target: 25 },  // warm up
        { duration: '60s', target: 100 },  // moderate
        { duration: '60s', target: 250 },  // ramp
        { duration: '60s', target: 400 },  // stress
        { duration: '60s', target: 500 },  // peak
        { duration: '30s', target: 0 },  // cool down
    ]*/
    stages: [
        { duration: '20s', target: 50 },
        { duration: '20s', target: 500 },
        { duration: '90s', target: 500 },
        { duration: '10s', target: 0 },
    ],
    thresholds: {
        // Microservices: record it but NEVER abort — let it die visibly in Grafana
        'http_req_duration{arch:microservices}': [
            { threshold: 'p(95)<1000', abortOnFail: false },
        ],
        // Monolith: record it but NEVER abort — let it die visibly in Grafana
        'http_req_duration{arch:monolith}': [
            { threshold: 'p(95)<30000', abortOnFail: false },
        ],
    },
    // Raise per-request timeout so actual latency is recorded instead of
    // silent "connection reset" errors masking the real degradation curve.
    http: {
        timeout: '120s',
    },
    // Full HTTP debug output — shows headers, timing breakdown, and body
    // when the monolith starts stalling so you can distinguish slow responses
    // from outright connection failures in the k6 terminal output.
    //httpDebug: 'headers',
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

    // Explicit timeout in setup() — without this, a slow monolith response
    // during the 60s-default fires before the server responds and kills the
    // entire k6 run with no metrics written at all.
    const res = http.get(`${TARGET}/products`, { timeout: '120s' });
    if (res.status !== 200) {
        fail(`setup() failed: GET /products returned ${res.status}. ` +
            `Seed the database first:\n` +
            `  Monolith:      curl -X POST ${TARGET}/seed\n` +
            `  Microservices: curl -X POST ${TARGET}/products/seed`);
    }

    const body = JSON.parse(res.body);
    const dataArray = Array.isArray(body) ? body : (body.products || []);
    // Both architectures return an array.
    // Monolith (Postgres)  → integer id field  e.g. 1, 2, 3
    // Microservices (Mongo) → string _id field e.g. "65bf73e934..."
    const ids = dataArray.map(p => String(p._id || p.id)).filter(Boolean);

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

// ─── VU-level session state ────────────────────────────────────────────────────
// These variables are module-level so they persist across iterations WITHIN the
// same VU. Each VU logs in once (first iteration), then reuses the token.
let vToken = null;  // JWT from login
let vUserId = null;  // userId returned by login

// ─── default() receives setup() data as first argument ────────────────────────
export default function (data) {
    const { TARGET, ids, arch } = data;
    const randomProduct = ids[randomIntBetween(0, ids.length - 1)];

    // ── Per-VU login: runs ONCE on the first iteration ────────────────────────
    // bcrypt.compare() on the server makes this genuinely CPU-intensive,
    // which stresses the monolith event loop differently from read requests.
    if (!vToken) {
        const loginPayload = JSON.stringify({ username: VU_USERNAME(), password: VU_PASSWORD });
        const loginRes = http.post(`${TARGET}/auth/login`, loginPayload, {
            timeout: '120s',
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'SessionLogin', arch }
        });

        check(loginRes, { 'session login ok': r => r.status === 200 });

        if (loginRes.status === 200) {
            const body = JSON.parse(loginRes.body);
            vToken = body.token;
            vUserId = String(body.userId);
        } else {
            // Login failed — mark so we skip this VU rather than polluting data
            vToken = '__failed__';
            vUserId = '1';
        }

        // First iteration = login only. Return early so the next iteration
        // begins immediately with an authenticated session.
        sleep(randomIntBetween(1, 3));
        return;
    }

    // If login failed for this VU, park it rather than sending unauth requests
    if (vToken === '__failed__') {
        sleep(1);
        return;
    }

    // ── All requests carry the session token ──────────────────────────────────
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vToken}`
    };

    // Per-request params builder — timeout MUST be here, not just in
    // options.http.timeout which k6 ignores at the per-request level.
    const p = (name, extraHeaders = {}) => ({
        timeout: '120s',
        tags: { name, arch },
        headers: { ...authHeaders, ...extraHeaders }
    });

    // ── FetchCatalog — fires EVERY iteration ─────────────────────────────────
    // Deterministic cache-read load; shows Redis hit rate collapsing under pressure.
    let res = http.get(`${TARGET}/products`, p('FetchCatalog'));
    check(res, { 'catalog 200': r => r.status === 200 });

    // ── PostComment — fires EVERY iteration ──────────────────────────────────
    // Deterministic write load; architectural difference is most visible here
    // (Postgres blocking vs RabbitMQ async). Makes failure curve reproducible.
    const commentPayload = JSON.stringify({
        userId: vUserId,
        content: `k6 stress comment VU=${__VU} iter=${__ITER}`
    });
    res = http.post(
        `${TARGET}/products/${randomProduct}/comments`,
        commentPayload,
        p('PostComment')
    );
    check(res, { 'comment accepted (201|202)': r => r.status === 201 || r.status === 202 });

    // ── One supplementary request, chosen probabilistically ──────────────────
    const roll = Math.random();

    if (roll < 0.05) {
        // PublishProduct (5%) - Native write + full catalog cache invalidate
        const prodPayload = JSON.stringify({
            name: `k6 Stress Product VU${__VU}`,
            price: 49.99,
            description: "Automatically published load test product.",
            stock: 100,
            category: "Load Test"
        });
        res = http.post(`${TARGET}/products`, prodPayload, p('PublishProduct'));
        check(res, { 'status is 201': r => r.status === 201 });

    } else if (roll < 0.15) {
        // PostReview (10%) — write with rating; tests review persistence path
        const reviewPayload = JSON.stringify({
            userId: vUserId,
            title: `k6 review VU=${__VU}`,
            content: `k6 stress review iter=${__ITER} — automated load test.`,
            rating: randomIntBetween(1, 5)
        });
        res = http.post(
            `${TARGET}/products/${randomProduct}/reviews`,
            reviewPayload,
            p('PostReview')
        );
        check(res, { 'review created (201)': r => r.status === 201 });

    } else if (roll < 0.25) {
        // PingDB (10%) — raw DB latency probe, bypasses Redis
        res = http.get(`${TARGET}/products/ping`, p('PingDB'));
        check(res, { 'ping ok': r => r.status === 200 });

    } else if (roll < 0.50) {
        // FetchProductDetails (25%)
        res = http.get(`${TARGET}/products/${randomProduct}`, p('FetchProductDetails'));
        check(res, { 'status is 200': r => r.status === 200 });

    } else if (roll < 0.75) {
        // FetchOrders (25%) — DB join with auth userId
        res = http.get(`${TARGET}/orders/${vUserId}`, p('FetchOrders'));
        check(res, { 'status is 200': r => r.status === 200 });

    } else if (roll < 0.85) {
        // AuthRegister (10%) — bcrypt hash on server (new user signups)
        const regPayload = JSON.stringify({ username: `k6_${randomString(10)}`, password: 'password123' });
        res = http.post(`${TARGET}/auth/register`, regPayload,
            p('AuthRegister', { 'Content-Type': 'application/json' })
        );
        check(res, { 'status is 201': r => r.status === 201 });

    } else if (roll < 0.87) {
        // LLMSummarize (2%) — external Groq API call; low weight to avoid 429 rate limits
        const llmPayload = JSON.stringify({ text: 'A standard k6 generated e-commerce product description for stress testing.' });
        res = http.post(`${TARGET}/llm/summarize`, llmPayload, p('LLMSummarize'));
        check(res, { 'status is 200': r => r.status === 200 });

    } else if (roll < 0.90) {
        // CreateContent (3%) — triggers microservice cross-communication (also calls LLM)
        const contentPayload = JSON.stringify({ lengthText: '2 sentences', targetUrl: TARGET });
        res = http.post(`${TARGET}/content/generate-product`, contentPayload, p('CreateContent'));
        check(res, { 'status is 200|201': r => r.status === 200 || r.status === 201 });

    } else {
        // CreateOrder (10%) — write + stock decrement + cache invalidation
        const orderPayload = JSON.stringify({
            userId: vUserId,
            totalAmount: 99.99,
            products: [{ productId: randomProduct, quantity: 1 }]
        });
        res = http.post(`${TARGET}/orders`, orderPayload, p('CreateOrder'));
        check(res, { 'status is 201': r => r.status === 201 });
    }

    sleep(randomIntBetween(1, 3));
}

// ─── teardown() runs ONCE after all VUs finish ────────────────────────────────
// Deletes only k6-generated comments (content starts with "k6 ").
// Products, orders, and real user data are left completely untouched.
export function teardown(data) {
    const { TARGET, arch } = data;

    console.log(`[teardown] arch=${arch} — deleting k6 test comments from ${TARGET}...`);

    const res = http.del(
        `${TARGET}/products/comments/k6`,
        null,
        { timeout: '60s' }
    );

    if (res.status === 200) {
        console.log(`[teardown] ✅ ${JSON.parse(res.body).message}`);
    } else {
        console.warn(`[teardown] ⚠️  Cleanup returned ${res.status}: ${res.body}`);
    }
}
