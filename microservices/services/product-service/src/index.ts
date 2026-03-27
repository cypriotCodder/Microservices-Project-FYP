import express from 'express';
import dotenv from 'dotenv';
import { Product } from './models/product';
import { Review } from './models/review';
import { seedProducts } from "./controllers/productController";
import connectDB from './config/db';
import { connectRedis, redisClient } from './config/redis';
import { connectToRabbitMQ, consumeOrderBoughtEvents, consumeOrderDeletedEvents } from "./utils/messageBroker";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});

app.get('/', async (req, res) => {
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

app.get('/:id', async (req, res) => {
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

app.post('/', async (req, res) => {
    try {
        const product = await Product.create(req.body);
        await redisClient.del('products:all'); // Invalidate cache
        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
});

app.delete('/all', async (req, res) => {
    try {
        await Product.deleteMany({});
        await Review.deleteMany({}); // Clean up orphaned reviews
        await redisClient.del('products:all'); // Invalidate cache
        res.json({ message: 'All products and reviews seamlessly wiped from database' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete products', error });
    }
});

app.post('/:productId/reviews', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviewData = { ...req.body, productId };
        const review = await Review.create(reviewData);
        res.status(201).json({ message: 'Review created', review });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create review', error });
    }
});

app.get('/:productId/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
});

app.post('/seed', seedProducts);

const startServer = async () => {
    connectDB();
    await connectRedis();

    // CONNECT TO RABBITMQ
    await connectToRabbitMQ();

    // START CONSUMING MESSAGES
    // 2. Start listening to queues
    await consumeOrderBoughtEvents();
    await consumeOrderDeletedEvents();

    app.listen(PORT, () => {
        console.log(`Product Service running on port ${PORT}`);
    });
};

startServer();
