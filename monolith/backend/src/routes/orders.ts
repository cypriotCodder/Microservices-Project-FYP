import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});

router.get('/', (req, res) => {
    res.json([
        { id: 1, productId: 1, quantity: 1, status: 'pending' }
    ]);
});

router.post('/', (req, res) => {
    const order = req.body;
    res.status(201).json({ message: 'Order created', order });
});

export default router;
