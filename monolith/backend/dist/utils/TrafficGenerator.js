"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficGenerator = void 0;
const axios_1 = __importDefault(require("axios"));
// The products and user credentials to simulate user activity
const SAMPLE_PRODUCTS = [
    "67a1122a611c002167d5aeaa", // Laptop
    "67a1122a611c002167d5aeab", // Headphones
    "67a213ff2e4ec55ad6ccad7d", // Mouse
];
const SAMPLE_USER_ID = "1";
class TrafficGenerator {
    constructor() {
        this.isRunning = false;
        this.targetUrl = '';
        this.rps = 0;
        this.intervalId = null;
        // Metrics
        this.totalRequestsSent = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.failuresByService = { auth: 0, products: 0, llm: 0, orders: 0 };
    }
    start(targetUrl, rps) {
        this.stop(); // Clear any existing runs
        this.targetUrl = targetUrl;
        this.isRunning = true;
        this.rps = rps;
        // Reset metrics
        this.totalRequestsSent = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.failuresByService = { auth: 0, products: 0, llm: 0, orders: 0 };
        console.log(`[Monolith Internal] Starting traffic generator against ${this.targetUrl} at ${this.rps} RPS`);
        const delayMs = 1000 / this.rps;
        this.intervalId = setInterval(() => {
            this.fireRequest();
        }, delayMs);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log(`[Monolith Internal] Stopped traffic generator`);
        console.log(`[Monolith Internal] Final stats: Sent ${this.totalRequestsSent}, Success ${this.successfulRequests}, Failed ${this.failedRequests}`);
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            targetUrl: this.targetUrl,
            rps: this.rps,
            metrics: {
                totalRequestsSent: this.totalRequestsSent,
                successfulRequests: this.successfulRequests,
                failedRequests: this.failedRequests,
                failuresByService: this.failuresByService
            }
        };
    }
    // Engine logic
    fireRequest() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.isRunning)
                return;
            this.totalRequestsSent++;
            const randomProduct = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];
            const roll = Math.random();
            let currentService = 'unknown';
            try {
                if (roll < 0.40) {
                    currentService = 'products';
                    // Fetch Catalog (40%)
                    yield axios_1.default.get(`${this.targetUrl}/products`, { timeout: 5000 });
                }
                else if (roll < 0.55) {
                    currentService = 'products';
                    // Click Product Details (15%)
                    yield axios_1.default.get(`${this.targetUrl}/products/${randomProduct}`, { timeout: 5000 });
                }
                else if (roll < 0.60) {
                    currentService = 'auth';
                    // Sign Up New User (5% - Stresses DB Writes)
                    const randomIdent = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                    yield axios_1.default.post(`${this.targetUrl}/auth/register`, {
                        username: `loadtest_${randomIdent}`,
                        password: 'password123'
                    }, { timeout: 5000 });
                }
                else if (roll < 0.70) {
                    currentService = 'auth';
                    // Sign In Existing User (10% - Stresses CPU / bcrypt)
                    yield axios_1.default.post(`${this.targetUrl}/auth/login`, {
                        username: `admin@fyp.com`,
                        password: 'admin'
                    }, { timeout: 5000 });
                }
                else if (roll < 0.80) {
                    currentService = 'llm';
                    // Predict/Summarize Product (10%)
                    const prodRes = yield axios_1.default.get(`${this.targetUrl}/products/${randomProduct}`, { timeout: 5000 });
                    const prodDesc = ((_a = prodRes.data) === null || _a === void 0 ? void 0 : _a.description) || "A standard e-commerce item.";
                    yield axios_1.default.post(`${this.targetUrl}/llm/summarize`, {
                        text: prodDesc
                    }, { timeout: 15000 });
                }
                else if (roll < 0.90) {
                    currentService = 'orders';
                    // Fetch Orders (10%)
                    yield axios_1.default.get(`${this.targetUrl}/orders`, { timeout: 5000 });
                }
                else {
                    currentService = 'orders';
                    // Checkout / Buy Product! (10%)
                    yield axios_1.default.post(`${this.targetUrl}/orders`, {
                        userId: SAMPLE_USER_ID,
                        totalAmount: 99.99, // Dummy price
                        products: [{ productId: randomProduct, quantity: 1 }]
                    }, { timeout: 5000 });
                }
                this.successfulRequests++;
            }
            catch (error) {
                this.failedRequests++;
                if (this.failuresByService[currentService] !== undefined) {
                    this.failuresByService[currentService]++;
                }
                else {
                    // If a new service type appears, initialize it
                    this.failuresByService[currentService] = 1;
                }
                if (this.failedRequests % Math.max(1, Math.floor(this.rps / 2)) === 0) {
                    console.error(`Traffic generation error burst... (Total failures: ${this.failedRequests})`);
                }
            }
        });
    }
}
exports.TrafficGenerator = TrafficGenerator;
