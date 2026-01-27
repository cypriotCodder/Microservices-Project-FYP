import { Router } from 'express';

const router = Router();

// Mock Data
const products = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Phone', price: 499 }
];

router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});

router.get('/', (req, res) => {
    res.json(products);
});

router.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});

export default router;
