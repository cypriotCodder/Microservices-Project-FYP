import { Router } from 'express';
import axios from 'axios';
import { Product } from '../models/products';
import { Review } from '../models/review';
import { redisClient } from '../config/redis';

const router = Router();

const adjectives = ["Incredible", "Fantastic", "Awesome", "Sleek", "Durable", "Portable", "Ergonomic", "Intelligent", "Futuristic", "Classic"];
const nouns = ["Widget", "Device", "Gadget", "Monitor", "Keyboard", "Headphones", "Speaker", "Camera", "Smartphone", "Tablet"];
const reviewPrefixes = ["I really love this", "Not bad, but", "Absolutely terrible", "Highly recommend this", "It's okay for the price", "Best purchase ever"];
const reviewSuffixes = ["would buy again.", "needs improvement.", "exceeded expectations.", "very disappointed.", "worth every penny.", "just average."];

function getRandomElement(arr: any[]): any {
    return arr[Math.floor(Math.random() * arr.length)];
}

router.post('/generate-product', async (req, res) => {
    const { lengthText = '2 sentences' } = req.body;
    const name = `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`;
    const price = Math.floor(Math.random() * 500) + 10;
    let description = `This is a randomly generated ${name.toLowerCase()}. It features a compelling design and great utilities.`;
    const stock = Math.floor(Math.random() * 100) + 1;

    // Try LLM generation
    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (groqApiKey && groqApiKey !== 'your_groq_api_key_here') {
            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: `You are an expert ecommerce copywriter. Write a compelling product description for a product named "${name}".\nThe description MUST be exactly this length: ${lengthText}.\nReturn strictly the description text. Do not include introductory phrases, quotes, or formatting.` },
                        { role: 'user', content: `Generate the description for: ${name}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const llmDescription = response.data.choices[0].message.content;
            if (llmDescription) description = llmDescription.trim();
        }
    } catch (error: any) {
        console.warn("LLM generation unavailable, using fallback:", error.message);
    }

    try {
        const product = await Product.create({
            name,
            price,
            description,
            stock
        });
        await redisClient.del('products:all');
        res.status(201).json({ message: 'Product created', data: product });
    } catch (error: any) {
        console.error("Error generating product:", error.message);
        res.status(500).json({ message: `Failed to generate product: ${error.message}` });
    }
});

router.post('/generate-review', async (req, res) => {
    try {
        const products = await Product.find();
        if (!products || products.length === 0) {
            return res.status(400).json({ message: "No products available to review." });
        }

        const randomProduct = getRandomElement(products);
        const title = `${getRandomElement(adjectives)}!`;
        const content = `${getRandomElement(reviewPrefixes)}, ${getRandomElement(reviewSuffixes)}`;
        const rating = Math.floor(Math.random() * 5) + 1;
        const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;

        const review = await Review.create({
            productId: randomProduct._id,
            userId,
            title,
            content,
            rating
        });

        res.status(201).json({ message: 'Review created', data: review });
    } catch (error: any) {
        console.error("Error generating review:", error.message);
        res.status(500).json({ message: `Failed to generate review: ${error.message}` });
    }
});

export default router;
