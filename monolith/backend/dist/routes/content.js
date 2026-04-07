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
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
const router = (0, express_1.Router)();
const adjectives = ["Incredible", "Fantastic", "Awesome", "Sleek", "Durable", "Portable", "Ergonomic", "Intelligent", "Futuristic", "Classic"];
const nouns = ["Widget", "Device", "Gadget", "Monitor", "Keyboard", "Headphones", "Speaker", "Camera", "Smartphone", "Tablet"];
const reviewPrefixes = ["I really love this", "Not bad, but", "Absolutely terrible", "Highly recommend this", "It's okay for the price", "Best purchase ever"];
const reviewSuffixes = ["would buy again.", "needs improvement.", "exceeded expectations.", "very disappointed.", "worth every penny.", "just average."];
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
// POST generate a new random product (with optional LLM description)
router.post('/generate-product', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lengthText = '2 sentences' } = req.body;
    const name = `${getRandomElement(adjectives)} ${getRandomElement(nouns)}`;
    const price = Math.floor(Math.random() * 500) + 10;
    let description = `This is a randomly generated ${name.toLowerCase()}. It features a compelling design and great utilities.`;
    const stock = Math.floor(Math.random() * 100) + 1;
    // Try LLM generation
    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (groqApiKey && groqApiKey !== 'your_groq_api_key_here') {
            const response = yield axios_1.default.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: `You are an expert ecommerce copywriter. Write a compelling product description for a product named "${name}".\nThe description MUST be exactly this length: ${lengthText}.\nReturn strictly the description text. Do not include introductory phrases, quotes, or formatting.` },
                    { role: 'user', content: `Generate the description for: ${name}` }
                ],
                temperature: 0.7,
                max_tokens: 4000
            }, {
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const llmDescription = response.data.choices[0].message.content;
            if (llmDescription)
                description = llmDescription.trim();
        }
    }
    catch (error) {
        console.warn("LLM generation unavailable, using fallback:", error.message);
    }
    try {
        const product = yield prisma_1.prisma.product.create({
            data: { name, price, description, stock }
        });
        yield redis_1.redisClient.del('products:all');
        res.status(201).json({ message: 'Product created', data: product });
    }
    catch (error) {
        console.error("Error generating product:", error.message);
        res.status(500).json({ message: `Failed to generate product: ${error.message}` });
    }
}));
// POST generate a random review for a random existing product
router.post('/generate-review', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma_1.prisma.product.findMany();
        if (!products || products.length === 0) {
            return res.status(400).json({ message: "No products available to review." });
        }
        const randomProduct = getRandomElement(products);
        const title = `${getRandomElement(adjectives)}!`;
        const content = `${getRandomElement(reviewPrefixes)}, ${getRandomElement(reviewSuffixes)}`;
        const rating = Math.floor(Math.random() * 5) + 1;
        const userId = `user_${Math.floor(Math.random() * 9000) + 1000}`;
        const review = yield prisma_1.prisma.review.create({
            data: {
                productId: randomProduct.id,
                userId,
                title,
                content,
                rating
            }
        });
        res.status(201).json({ message: 'Review created', data: review });
    }
    catch (error) {
        console.error("Error generating review:", error.message);
        res.status(500).json({ message: `Failed to generate review: ${error.message}` });
    }
}));
exports.default = router;
