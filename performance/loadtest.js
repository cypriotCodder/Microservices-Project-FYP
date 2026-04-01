import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// The products and user credentials to simulate realistic traffic flows
const SAMPLE_PRODUCTS = [
    "67a1122a611c002167d5aeaa", // Laptop
    "67a1122a611c002167d5aeab", // Headphones
    "67a213ff2e4ec55ad6ccad7d", // Mouse
];

const SAMPLE_USER_ID = "1";

export const options = {
    // 1. You can manually adjust this to hit 10,000+ RPS concurrently.
    // Example: 2000 Virtual Users over 2 minutes executing wildly.
    stages: [
        { duration: '10s', target: 50 },  // Ramp up to 50 Users
        { duration: '180s', target: 10000 }, // Spike 500 Users
        { duration: '10s', target: 0 },   // Cool down
    ],
    thresholds: {
        http_req_failed: ['rate<0.1'], // Test automatically fails if >10% of requests randomly drop
        http_req_duration: ['p(95)<1000'], // 95% of requests theoretically must execute < 1s
    },
};

export default function () {
    const TARGET = __ENV.TARGET_URL || 'http://host.docker.internal:8080';

    const randomProduct = SAMPLE_PRODUCTS[randomIntBetween(0, SAMPLE_PRODUCTS.length - 1)];
    const roll = Math.random();

    let res;

    // Simulating exactly the same historical UI matrix distributions natively in Go.
    if (roll < 0.40) {
        // Fetch Catalog (40%)
        res = http.get(`${TARGET}/products`, { tags: { name: 'FetchCatalog' } });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.55) {
        // Click Product Details (15%)
        res = http.get(`${TARGET}/products/${randomProduct}`, { tags: { name: 'FetchProductDetails' } });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.60) {
        // Sign Up New User (5% - Intensive Write Simulation)
        const payload = JSON.stringify({
            username: `k6test_${randomString(10)}`,
            password: 'password123'
        });
        const headers = { 'Content-Type': 'application/json' };
        res = http.post(`${TARGET}/auth/register`, payload, { headers, tags: { name: 'AuthRegister' } });
        check(res, { 'status is 201': (r) => r.status === 201 });

    } else if (roll < 0.70) {
        // Sign In Admin (10% - Intensive CPU simulation via bcrypt loops)
        const payload = JSON.stringify({
            username: `admin@fyp.com`,
            password: 'admin'
        });
        const headers = { 'Content-Type': 'application/json' };
        res = http.post(`${TARGET}/auth/login`, payload, { headers, tags: { name: 'AuthLogin' } });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.80) {
        // AI Predict/Summarize Product (10%)
        const prodPayload = JSON.stringify({ text: "A standard k6 generated e-commerce item." });
        const headers = { 'Content-Type': 'application/json' };
        res = http.post(`${TARGET}/llm/summarize`, prodPayload, { headers, tags: { name: 'LLMSummarize' } });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else if (roll < 0.90) {
        // Fetch Orders (10%)
        res = http.get(`${TARGET}/orders`, { tags: { name: 'FetchOrders' } });
        check(res, { 'status is 200': (r) => r.status === 200 });

    } else {
        // Checkout / Buy Product! (10%)
        const payload = JSON.stringify({
            userId: SAMPLE_USER_ID,
            totalAmount: 99.99,
            products: [{ productId: randomProduct, quantity: 1 }]
        });
        const headers = { 'Content-Type': 'application/json' };
        res = http.post(`${TARGET}/orders`, payload, { headers, tags: { name: 'CreateOrder' } });
        check(res, { 'status is 201': (r) => r.status === 201 });
    }

    // Brief realistic pause to prevent immediate CPU self-starvation locally.
    sleep(0.1);
}
