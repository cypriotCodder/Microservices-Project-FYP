import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:8080';

const generateTraffic = async () => {
    console.log('Starting traffic generation...');

    // Simulate a user session loop
    while (true) {
        try {
            console.log('--- New Traffic Cycle ---');

            // 1. Check Product Health (or list products)
            console.log('Fetching products...');
            try {
                await axios.get(`${API_GATEWAY_URL}/products`);
            } catch (e: any) { console.error('Product fetch failed', e.code); }

            // 2. Request Recommendation
            console.log('Fetching recommendations...');
            try {
                // Random user ID
                const userId = Math.floor(Math.random() * 1000).toString();
                await axios.get(`${API_GATEWAY_URL}/recommendations/${userId}`);
            } catch (e: any) { console.error('Recommendation fetch failed', e.code); }

            // 3. Request LLM Summary (simulated)
            console.log('Requesting summary...');
            try {
                await axios.post(`${API_GATEWAY_URL}/llm/summarize`, {
                    text: "This is a very long product description that needs summarizing. " +
                        "It has many details about features, specifications, and benefits. " +
                        "The user wants a quick overview."
                });
            } catch (e: any) { console.error('Summary request failed', e.code); }

            // Random delay between 1 and 5 seconds
            const delay = Math.floor(Math.random() * 4000) + 1000;
            console.log(`Waiting ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));

        } catch (error) {
            console.error('Traffic generator error loop:', error);
            // Wait a bit if major error
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Start generation with a small delay to allow other services to come up
setTimeout(() => {
    generateTraffic();
}, 10000);
