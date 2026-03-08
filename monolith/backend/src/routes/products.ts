import { Router } from 'express';
import { Product } from '../models/products';
import { Review } from '../models/review';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});

router.get('/', async (req, res) => {
    //fetch from the database
    const products = await Product.find();
    res.json(products);
});

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
});

router.post('/', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
});

router.post('/:productId/reviews', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviewData = { ...req.body, productId };
        const review = await Review.create(reviewData);
        res.status(201).json({ message: 'Review created', review });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create review', error });
    }
});

router.get('/:productId/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
});

export default router;
