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
const router = (0, express_1.Router)();
router.post('/summarize', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ message: 'Text is required' });
    }
    try {
        console.log("Fetching summary from Groq LLaMA API...");
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey || groqApiKey === 'your_groq_api_key_here') {
            return res.status(500).json({ message: "Groq API Key is missing. Please add it to the monolith/backend/.env file and restart the docker image." });
        }
        const response = yield axios_1.default.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that concisely summarizes product descriptions into exactly one sentence.' },
                { role: 'user', content: `Summarize the following product description:\n\n${text}` }
            ],
            temperature: 0.5,
            max_tokens: 150
        }, {
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        const summary = response.data.choices[0].message.content;
        res.json({
            originalLength: text.length,
            summary,
            note: "Generated via Hosted Groq Llama3"
        });
    }
    catch (error) {
        console.error("LLM Service Error:", error);
        res.status(500).json({ message: "Failed to generate summary" });
    }
}));
router.post('/generate-description', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, lengthText } = req.body;
    if (!name || !lengthText) {
        return res.status(400).json({ message: 'Name and lengthText are required' });
    }
    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey || groqApiKey === 'your_groq_api_key_here') {
            return res.status(500).json({ message: "Groq API Key is missing." });
        }
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
        const description = response.data.choices[0].message.content;
        res.json({
            description,
            note: "Generated via Hosted Groq Llama3"
        });
    }
    catch (error) {
        console.error("LLM Generation Error:", error);
        res.status(500).json({ message: "Failed to generate description" });
    }
}));
exports.default = router;
