import axios from 'axios';

const adjectives = ["Incredible", "Fantastic", "Awesome", "Sleek", "Durable", "Portable", "Ergonomic", "Intelligent", "Futuristic", "Classic"];
const nouns = ["Widget", "Device", "Gadget", "Monitor", "Keyboard", "Headphones", "Speaker", "Camera", "Smartphone", "Tablet"];
const reviewPrefixes = ["I really love this", "Not bad, but", "Absolutely terrible", "Highly recommend this", "It's okay for the price", "Best purchase ever"];
const reviewSuffixes = ["would buy again.", "needs improvement.", "exceeded expectations.", "very disappointed.", "worth every penny.", "just average."];

function getRandomElement(arr: any[]): any {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateFallbackDescription(name: string, lengthText: string): string {
    const baseParagraph = `The ${name} is an exceptional piece of technology designed to meet your highest expectations. It combines unparalleled functionality with a sleek, modern aesthetic that fits perfectly into any setting. Crafted with precision, the ${name} offers a robust array of features that ensure top-tier performance, reliability, and ease of use. Whether you are using it for professional tasks or everyday convenience, it is engineered to deliver a seamless and satisfying experience.`;

    if (lengthText.includes('1 short sentence') || lengthText.includes('2 short')) {
        return `This is a randomly generated ${name.toLowerCase()}. It features a compelling design and great utilities.`;
    } else if (lengthText.includes('1 detailed paragraph')) {
        return baseParagraph;
    } else if (lengthText.includes('2 large paragraphs')) {
        return baseParagraph + '\n\n' + baseParagraph.replace(new RegExp(name, 'g'), 'device');
    } else if (lengthText.includes('extremely long') || lengthText.includes('SEO')) {
        let massiveText = '';
        for (let i = 0; i < 25; i++) {
            massiveText += baseParagraph.replace(new RegExp(name, 'g'), name + (i > 0 ? ' Pro Edition V' + i : '')) + ' ';
            if (i % 4 === 3) massiveText += '\n\n';
        }
        return massiveText.trim();
    }
    return `This is a randomly generated ${name.toLowerCase()}. It features a compelling design and great utilities.`;
}

export class ContentGenerator {

    // Generate a new random product
    public async generateProduct(targetUrl: string, lengthText: string = '2 sentences'): Promise<any> {
        const name = `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`;
        const price = Math.floor(Math.random() * 500) + 10;
        let description = generateFallbackDescription(name, lengthText);
        const stock = Math.floor(Math.random() * 100) + 1;

        if (lengthText.includes('extremely long')) {
            description = `Welcome to the ultimate deep-dive review and specification analysis of this incredible product. When evaluating modern consumer technology, the intersection of performance, design, and reliable utility is absolute paramount. The engineers behind this product spent thousands of hours iterating on its core structural architecture to deliver an experience that seamlessly blends into your life while dramatically elevating your capabilities.\n\nFrom the moment you unbox this masterpiece, you're greeted with a premium aesthetic that speaks volumes about the meticulous attention to detail. The materials used in its construction were carefully selected to offer both lightweight portability and uncompromising durability. The chassis is robust, resisting the daily wear and tear that typically degrades inferior alternatives.\n\nBut beauty here is more than skin deep. Under the hood, this device boasts state-of-the-art internal components that harmonize to produce industry-leading performance. It operates with a silent efficiency that masks the immense power at your fingertips. Navigating its features is incredibly intuitive, thanks to a user-centric design philosophy that anticipates your needs before you even realize them.\n\nLet's talk about the specifications. Every metric has been optimized. The battery life, where applicable, breaks previous benchmarks, ensuring you stay connected and productive throughout your most demanding days. The thermal management system is remarkably advanced, keeping the core cool even under sustained heavy loads. Connections are lightning-fast and universally compatible, meaning you'll never find yourself isolated from the ecosystem of devices you rely on.\n\nIn a market saturated with empty promises and iterative updates, this stands as a monumental leap forward. It doesn't just meet the gold standard; it redefines it. Unrivaled in its category, this is an undeniable must-have for professionals, enthusiasts, and anyone who refuses to settle for mediocrity.\n\n`.repeat(15);
        } else {
            try {
                // Attempt to dynamically generate description via the internal LLM proxy
                const llmRes = await axios.post(`http://llm-service:3005/generate-description`, { name, lengthText });
                if (llmRes.data && llmRes.data.description) {
                    description = llmRes.data.description.trim();
                }
            } catch (error: any) {
                console.warn("LLM generation unavailable, falling back to static generic description:", error.message);
            }
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

            const url = `http://product-service:3002/`;
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
            const productsUrl = `http://product-service:3002/`;
            const productsRes = await axios.get(productsUrl);
            const products = productsRes.data.products || productsRes.data;

            if (!products || !Array.isArray(products) || products.length === 0) {
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

            const reviewUrl = `http://product-service:3002/${productId}/reviews`;
            const response = await axios.post(reviewUrl, payload);
            return response.data;
        } catch (error: any) {
            console.error("Error generating review:", error.message);
            throw new Error(`Failed to generate review: ${error.message}`);
        }
    }
}
