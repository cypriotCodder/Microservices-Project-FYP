import { Router } from 'express';
import { Product } from '../models/products';
import { Review } from '../models/review';
import { redisClient } from '../config/redis';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});

router.get('/', async (req, res) => {
    try {
        const cachedProducts = await redisClient.get('products:all');
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }

        const products = await Product.find();
        
        await redisClient.setEx('products:all', 3600, JSON.stringify(products));
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const cacheKey = `product:${req.params.id}`;
        const cachedProduct = await redisClient.get(cacheKey);
        if (cachedProduct) {
            return res.json(JSON.parse(cachedProduct));
        }

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(product));
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
});

router.post('/', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        await redisClient.del('products:all');
        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
});

router.delete('/all', async (req, res) => {
    try {
        await Product.deleteMany({});
        await Review.deleteMany({}); // Clean up orphaned reviews
        await redisClient.del('products:all'); // Invalidate cache
        res.json({ message: 'All products and reviews seamlessly wiped from database' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete products', error });
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
