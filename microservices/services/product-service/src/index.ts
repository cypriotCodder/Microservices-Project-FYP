import express from 'express';
import dotenv from 'dotenv';
import { Product } from './models/product';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});

app.get('/', (req, res) => {
    // Other fake products
    res.json([
        { id: 1, name: 'Laptop', price: 999 },
        { id: 2, name: 'Phone', price: 499 }
    ]);
});

app.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});

app.listen(PORT, () => {
    console.log(`Product Service running on port ${PORT}`);
});
