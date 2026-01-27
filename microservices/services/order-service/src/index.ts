import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Order Service is running' });
});

app.get('/', (req, res) => {
    res.json([
        { id: 1, productId: 1, quantity: 1, status: 'pending' }
    ]);
});

app.post('/', (req, res) => {
    const order = req.body;
    res.status(201).json({ message: 'Order created', order });
});

app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
});
