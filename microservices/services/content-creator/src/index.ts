import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ContentGenerator } from './ContentGenerator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(express.json());

const generator = new ContentGenerator();

// Expose control APIs
app.post('/generate-product', async (req, res) => {
    const { lengthText } = req.body;

    try {
        const result = await generator.generateProduct('', lengthText || '2 sentences');
        res.json({ message: 'Product generated successfully', data: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/generate-review', async (req, res) => {
    try {
        const result = await generator.generateReview('');
        res.json({ message: 'Review generated successfully', data: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ status: 'Content Creator Service is running' });
});

app.listen(PORT, () => {
    console.log(`Content Creator Service running on port ${PORT}`);
});
