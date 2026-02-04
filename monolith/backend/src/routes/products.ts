import { Router } from 'express';
import connectDB from '../config/db';
import { Product } from '../models/products';

const router = Router();
connectDB();

router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});

router.get('/', async (req, res) => {
    //fetch from the database
    const products = await Product.find();
    res.json(products);
});

router.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});

export default router;
