/**
 * chaos-loadtest.js
 * 
 * Dedicated k6 script for Pumba chaos testing.
 * Capped at 100 VUs so the auth service gateway doesn't saturate,
 * allowing the 5s LLM delay injected by Pumba to show clearly in metrics.
 */
import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const ARCH = __ENV.ARCH || 'chaos';
const VU_USERNAME = () => `user${(__VU - 1) % 50}@test.com`;
const VU_PASSWORD = 'password123';

export const options = {
    stages: [
        { duration: '30s', target: 20  },  // warm up
        { duration: '60s', target: 60  },  // moderate load
        { duration: '60s', target: 100 },  // sustained load under chaos
        { duration: '60s', target: 100 },  // hold — Pumba delay visible here
        { duration: '30s', target: 0   },  // cool down
    ],
    thresholds: {
        'http_req_duration{arch:chaos}': [
            { threshold: 'p(95)<10000', abortOnFail: false },
        ],
    },
    http: { timeout: '120s' },
};

export function setup() {
    const TARGET = __ENV.TARGET_URL || 'http://host.docker.internal:8080';
    const res = http.get(`${TARGET}/products`, { timeout: '60s' });
    if (res.status !== 200) {
        fail(`setup() failed: GET /products returned ${res.status}`);
    }
    const body = JSON.parse(res.body);
    const dataArray = Array.isArray(body) ? body : (body.products || []);
    const ids = dataArray.map(p => String(p._id || p.id)).filter(Boolean);
    if (ids.length === 0) fail('setup() failed: product list empty');
    console.log(`[setup] arch=${ARCH} | target=${TARGET} | ${ids.length} products`);
    return { TARGET, ids, arch: ARCH };
}

let vToken = null;
let vUserId = null;

export default function (data) {
    const { TARGET, ids, arch } = data;
    const randomProduct = ids[randomIntBetween(0, ids.length - 1)];

    // Login once per VU
    if (!vToken) {
        const loginRes = http.post(`${TARGET}/auth/login`,
            JSON.stringify({ username: VU_USERNAME(), password: VU_PASSWORD }),
            { timeout: '60s', headers: { 'Content-Type': 'application/json' }, tags: { name: 'SessionLogin', arch } }
        );
        check(loginRes, { 'session login ok': r => r.status === 200 });
        if (loginRes.status === 200) {
            const body = JSON.parse(loginRes.body);
            vToken = body.token;
            vUserId = String(body.userId);
        } else {
            vToken = '__failed__';
            vUserId = '1';
        }
        sleep(randomIntBetween(1, 2));
        return;
    }
    if (vToken === '__failed__') { sleep(1); return; }

    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vToken}` };
    const p = (name) => ({ timeout: '120s', tags: { name, arch }, headers: authHeaders });

    // Core loop — fires every iteration
    let res = http.get(`${TARGET}/products`, p('FetchCatalog'));
    check(res, { 'catalog 200': r => r.status === 200 });

    res = http.post(`${TARGET}/products/${randomProduct}/comments`,
        JSON.stringify({ userId: vUserId, content: `chaos-k6 VU=${__VU} iter=${__ITER}` }),
        p('PostComment')
    );
    check(res, { 'comment ok': r => r.status === 201 || r.status === 202 });

    // Probabilistic actions — LLMSummarize at 20% so it triggers often enough to measure
    const roll = Math.random();
    if (roll < 0.20) {
        // LLMSummarize — will be delayed 5s by Pumba. The KEY metric to watch.
        res = http.post(`${TARGET}/llm/summarize`,
            JSON.stringify({ text: 'A standard chaos test product description for load testing.' }),
            p('LLMSummarize')
        );
        check(res, { 'llm ok': r => r.status === 200 });
    } else if (roll < 0.45) {
        res = http.get(`${TARGET}/products/${randomProduct}`, p('FetchProductDetails'));
        check(res, { 'product ok': r => r.status === 200 });
    } else if (roll < 0.70) {
        res = http.get(`${TARGET}/orders/${vUserId}`, p('FetchOrders'));
        check(res, { 'orders ok': r => r.status === 200 });
    } else if (roll < 0.85) {
        res = http.post(`${TARGET}/orders`,
            JSON.stringify({ userId: vUserId, totalAmount: 99.99, products: [{ productId: randomProduct, quantity: 1 }] }),
            p('CreateOrder')
        );
        check(res, { 'order ok': r => r.status === 201 });
    } else {
        res = http.post(`${TARGET}/auth/register`,
            JSON.stringify({ username: `chaos_${randomString(8)}`, password: 'password123' }),
            p('AuthRegister')
        );
        check(res, { 'register ok': r => r.status === 201 });
    }

    sleep(randomIntBetween(1, 2));
}

export function teardown(data) {
    const { TARGET } = data;
    const res = http.del(`${TARGET}/products/comments/chaos-k6`, null, { timeout: '30s' });
    console.log(`[teardown] cleanup: ${res.status}`);
}
