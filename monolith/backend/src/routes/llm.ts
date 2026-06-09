import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.post('/summarize', async (req, res) => {
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

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that concisely summarizes product descriptions into exactly one sentence.' },
                    { role: 'user', content: `Summarize the following product description:\n\n${text}` }
                ],
                temperature: 0.5,
                max_tokens: 150
            },
            {
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // 5s hard cap — fail fast on rate limits / stalls
            }
        );

        const summary = response.data.choices[0].message.content;

        res.json({
            originalLength: text.length,
            summary,
            note: "Generated via Hosted Groq Llama3"
        });
    } catch (error) {
        console.error("LLM Service Error:", error);
        res.status(500).json({ message: "Failed to generate summary" });
    }
});

router.post('/generate-description', async (req, res) => {
    const { name, lengthText } = req.body;
    if (!name || !lengthText) {
        return res.status(400).json({ message: 'Name and lengthText are required' });
    }

    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey || groqApiKey === 'your_groq_api_key_here') {
             return res.status(500).json({ message: "Groq API Key is missing." });
        }

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
                },
                timeout: 5000 // 5s hard cap — fail fast on rate limits / stalls
            }
        );

        const description = response.data.choices[0].message.content;

        res.json({
            description,
            note: "Generated via Hosted Groq Llama3"
        });
    } catch (error) {
        console.error("LLM Generation Error:", error);
        res.status(500).json({ message: "Failed to generate description" });
    }
});

export default router;
