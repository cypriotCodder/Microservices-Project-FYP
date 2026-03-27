import axios from 'axios';

const adjectives = ["Incredible", "Fantastic", "Awesome", "Sleek", "Durable", "Portable", "Ergonomic", "Intelligent", "Futuristic", "Classic"];
const nouns = ["Widget", "Device", "Gadget", "Monitor", "Keyboard", "Headphones", "Speaker", "Camera", "Smartphone", "Tablet"];
const reviewPrefixes = ["I really love this", "Not bad, but", "Absolutely terrible", "Highly recommend this", "It's okay for the price", "Best purchase ever"];
const reviewSuffixes = ["would buy again.", "needs improvement.", "exceeded expectations.", "very disappointed.", "worth every penny.", "just average."];

function getRandomElement(arr: any[]): any {
    return arr[Math.floor(Math.random() * arr.length)];
}

export class ContentGenerator {

    // Generate a new random product
    public async generateProduct(targetUrl: string, lengthText: string = '2 sentences'): Promise<any> {
        const name = `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`;
        const price = Math.floor(Math.random() * 500) + 10;
        let description = `This is a randomly generated ${name.toLowerCase()}. It features a compelling design and great utilities.`;
        const stock = Math.floor(Math.random() * 100) + 1;

        try {
            // Attempt to dynamically generate description via the internal LLM proxy
            const llmRes = await axios.post(`${targetUrl}/llm/generate-description`, { name, lengthText });
            if (llmRes.data && llmRes.data.description) {
                description = llmRes.data.description.trim();
            }
        } catch (error: any) {
            console.warn("LLM generation unavailable, falling back to static generic description:", error.message);
        }

        try {
            const payload = {
                name,
                price,
                description,
                image: `https://via.placeholder.com/150?text=${encodeURIComponent(name)}`,
                category: "Electronics",
                stock
            };

            const url = `${targetUrl}/products`;
            const response = await axios.post(url, payload);
            return response.data;
        } catch (error: any) {
            console.error("Error generating product:", error.message);
            throw new Error(`Failed to generate product: ${error.message}`);
        }
    }

    // Generate a random review for an existing product
    public async generateReview(targetUrl: string): Promise<any> {
        try {
            // 1. Fetch products to get a valid productId
            const productsUrl = `${targetUrl}/products`;
            const productsRes = await axios.get(productsUrl);
            const products = productsRes.data;

            if (!products || products.length === 0) {
                throw new Error("No products available to review.");
            }

            // Pick a random product
            const randomProduct = getRandomElement(products);
            const productId = randomProduct._id || randomProduct.id;

            // 2. Generate random review
            const title = `${getRandomElement(adjectives)}!`;
            const content = `${getRandomElement(reviewPrefixes)}, ${getRandomElement(reviewSuffixes)}`;
            const rating = Math.floor(Math.random() * 5) + 1;
            const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`; // Fake user ID

            const payload = {
                userId,
                title,
                content,
                rating
            };

            const reviewUrl = `${targetUrl}/products/${productId}/reviews`;
            const response = await axios.post(reviewUrl, payload);
            return response.data;
        } catch (error: any) {
            console.error("Error generating review:", error.message);
            throw new Error(`Failed to generate review: ${error.message}`);
        }
    }
}
