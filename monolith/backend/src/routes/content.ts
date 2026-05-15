import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';
import { delByPattern } from '../utils/cacheUtils';


const router = Router();

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

// POST generate a new random product (with optional LLM description)
router.post('/generate-product', async (req, res) => {
    const { lengthText = '2 sentences' } = req.body;
    const name = `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`;
    const price = Math.floor(Math.random() * 500) + 10;
    let description = generateFallbackDescription(name, lengthText);
    const stock = Math.floor(Math.random() * 100) + 1;

    if (lengthText.includes('extremely long')) {
        description = `Welcome to the ultimate deep-dive review and specification analysis of this incredible product. When evaluating modern consumer technology, the intersection of performance, design, and reliable utility is absolute paramount. The engineers behind this product spent thousands of hours iterating on its core structural architecture to deliver an experience that seamlessly blends into your life while dramatically elevating your capabilities.\n\nFrom the moment you unbox this masterpiece, you're greeted with a premium aesthetic that speaks volumes about the meticulous attention to detail. The materials used in its construction were carefully selected to offer both lightweight portability and uncompromising durability. The chassis is robust, resisting the daily wear and tear that typically degrades inferior alternatives.\n\nBut beauty here is more than skin deep. Under the hood, this device boasts state-of-the-art internal components that harmonize to produce industry-leading performance. It operates with a silent efficiency that masks the immense power at your fingertips. Navigating its features is incredibly intuitive, thanks to a user-centric design philosophy that anticipates your needs before you even realize them.\n\nLet's talk about the specifications. Every metric has been optimized. The battery life, where applicable, breaks previous benchmarks, ensuring you stay connected and productive throughout your most demanding days. The thermal management system is remarkably advanced, keeping the core cool even under sustained heavy loads. Connections are lightning-fast and universally compatible, meaning you'll never find yourself isolated from the ecosystem of devices you rely on.\n\nIn a market saturated with empty promises and iterative updates, this stands as a monumental leap forward. It doesn't just meet the gold standard; it redefines it. Unrivaled in its category, this is an undeniable must-have for professionals, enthusiasts, and anyone who refuses to settle for mediocrity.\n\n`.repeat(15);
    } else {
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
    }

    try {
        const product = await prisma.product.create({
            data: { name, price, description, stock, image: `https://via.placeholder.com/150?text=${encodeURIComponent(name)}`, category: 'Electronics' }
        });
        // Bug #1 fix: products:all was never written — removed that dead del call.
        // Bug #3 fix: use SCAN-based delByPattern instead of blocking KEYS.
        await delByPattern('products:page:*');
        res.status(201).json({ message: 'Product created', data: product });
    } catch (error: any) {
        console.error("Error generating product:", error.message);
        res.status(500).json({ message: `Failed to generate product: ${error.message}` });
    }
});

// POST generate a random review for a random existing product
router.post('/generate-review', async (req, res) => {
    try {
        const products = await prisma.product.findMany();
        if (!products || products.length === 0) {
            return res.status(400).json({ message: "No products available to review." });
        }

        const randomProduct = getRandomElement(products);
        const title = `${getRandomElement(adjectives)}!`;
        const content = `${getRandomElement(reviewPrefixes)}, ${getRandomElement(reviewSuffixes)}`;
        const rating = Math.floor(Math.random() * 5) + 1;
        const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;

        const review = await prisma.review.create({
            data: {
                productId: randomProduct.id,
                userId,
                title,
                content,
                rating
            }
        });

        res.status(201).json({ message: 'Review created', data: review });
    } catch (error: any) {
        console.error("Error generating review:", error.message);
        res.status(500).json({ message: `Failed to generate review: ${error.message}` });
    }
});

export default router;
