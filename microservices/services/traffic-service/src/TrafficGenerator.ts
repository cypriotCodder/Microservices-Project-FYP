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

        console.log(`Starting traffic generator against ${this.targetUrl} at ${this.rps} RPS`);

        // Calculate how many ms to wait between batches to achieve target RPS
        // We evaluate per second for simplicity, but Node.js setInterval isn't perfect
        // Better to spread requests over the second. E.g., 100 rps = 1 request every 10ms
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
        console.log(`Stopped traffic generator`);
        console.log(`Final stats: Sent ${this.totalRequestsSent}, Success ${this.successfulRequests}, Failed ${this.failedRequests}`);
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

        // Determine what kind of request to send simulating a real user flow.
        // E.g., 70% chance to browse products, 20% to check orders, 10% to buy something.
        const roll = Math.random();

        try {
            if (roll < 0.7) {
                // Fetch Products
                await axios.get(`${this.targetUrl}/products`, { timeout: 5000 });
            } else if (roll < 0.9) {
                // Fetch Orders
                await axios.get(`${this.targetUrl}/orders`, { timeout: 5000 });
            } else {
                // Buy a random product!
                const randomProduct = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];
                await axios.post(`${this.targetUrl}/orders`, {
                    userId: SAMPLE_USER_ID,
                    totalAmount: 99.99, // Dummy price
                    products: [{ productId: randomProduct, quantity: 1 }]
                }, { timeout: 5000 });
            }
            this.successfulRequests++;
        } catch (error: any) {
            this.failedRequests++;
            // We don't want to spam the console excessively at 500 RPS if the server is down
            // But we will log occasional errors
            if (this.failedRequests % Math.max(1, Math.floor(this.rps / 2)) === 0) {
                console.error(`Traffic generation error burst... (Total failures: ${this.failedRequests})`);
            }
        }
    }
}
