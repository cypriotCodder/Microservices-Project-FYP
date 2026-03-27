import axios from 'axios';

// The products and user credentials to simulate user activity
const SAMPLE_PRODUCTS = [
    "67a1122a611c002167d5aeaa", // Laptop
    "67a1122a611c002167d5aeab", // Headphones
    "67a213ff2e4ec55ad6ccad7d", // Mouse
];

const SAMPLE_USER_ID = "1";

export class TrafficGenerator {
    private isRunning: boolean = false;
    private targetUrl: string = '';
    private rps: number = 0;
    private intervalId: NodeJS.Timeout | null = null;

    // Metrics
    private totalRequestsSent = 0;
    private successfulRequests = 0;
    private failedRequests = 0;

    start(targetUrl: string, rps: number) {
        this.stop(); // Clear any existing runs
        this.targetUrl = targetUrl;
        this.isRunning = true;
        this.rps = rps;

        // Reset metrics
        this.totalRequestsSent = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;

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
            }
        };
    }

    // Engine logic
    private async fireRequest() {
        if (!this.isRunning) return;

        this.totalRequestsSent++;

        const randomProduct = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];
        const roll = Math.random();

        try {
            if (roll < 0.40) {
                // Fetch Catalog (40%)
                await axios.get(`${this.targetUrl}/products`, { timeout: 5000 });
            } else if (roll < 0.55) {
                // Click Product Details (15%)
                await axios.get(`${this.targetUrl}/products/${randomProduct}`, { timeout: 5000 });
            } else if (roll < 0.60) {
                // Sign Up New User (5% - Stresses DB Writes)
                const randomIdent = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                await axios.post(`${this.targetUrl}/auth/register`, {
                    name: 'LoadTest User',
                    email: `loadtest_${randomIdent}@test.com`,
                    password: 'password123'
                }, { timeout: 5000 });
            } else if (roll < 0.70) {
                // Sign In Existing User (10% - Stresses CPU / bcrypt)
                await axios.post(`${this.targetUrl}/auth/login`, {
                    email: `admin@fyp.com`,
                    password: 'admin'
                }, { timeout: 5000 });
            } else if (roll < 0.80) {
                // Predict/Summarize Product (10%)
                const prodRes = await axios.get(`${this.targetUrl}/products/${randomProduct}`, { timeout: 5000 });
                const prodDesc = prodRes.data?.description || "A standard e-commerce item.";

                await axios.post(`${this.targetUrl}/llm/summarize`, {
                    text: prodDesc
                }, { timeout: 15000 });
            } else if (roll < 0.90) {
                // Fetch Orders (10%)
                await axios.get(`${this.targetUrl}/orders`, { timeout: 5000 });
            } else {
                // Checkout / Buy Product! (10%)
                await axios.post(`${this.targetUrl}/orders`, {
                    userId: SAMPLE_USER_ID,
                    totalAmount: 99.99, // Dummy price
                    products: [{ productId: randomProduct, quantity: 1 }]
                }, { timeout: 5000 });
            }
            this.successfulRequests++;
        } catch (error: any) {
            this.failedRequests++;
            if (this.failedRequests % Math.max(1, Math.floor(this.rps / 2)) === 0) {
                console.error(`Traffic generation error burst... (Total failures: ${this.failedRequests})`);
            }
        }
    }
}
