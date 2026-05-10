import './tracing';
import express from 'express';
import dotenv from 'dotenv';
import { Product } from './models/product';
import { Review } from './models/review';
import { Comment } from './models/comment';
import { seedProducts } from "./controllers/productController";
import connectDB from './config/db';
import { connectRedis, redisClient } from './config/redis';
import { connectToRabbitMQ, consumeOrderBoughtEvents, consumeOrderDeletedEvents, consumeCommentCreatedEvents, publishCommentCreatedEvent } from "./utils/messageBroker";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});

app.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const category = req.query.category as string || "All";
        const sort = req.query.sort as string || ""; // e.g. "price-asc"

        // Short 60s cache specifically for paginated and sorted queries to limit redis stale drift
        const cacheKey = `products:page:${page}:limit:${limit}:cat:${category}:sort:${sort}`;
        const cachedProducts = await redisClient.get(cacheKey);
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }

        let query: any = {};
        if (category !== "All") {
            query.category = category;
        }

        let sortQuery: any = {};
        if (sort === 'price-asc') sortQuery.price = 1;
        if (sort === 'price-desc') sortQuery.price = -1;
        if (sort === 'name-asc') sortQuery.name = 1;
        if (sort === 'name-desc') sortQuery.name = -1;

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(query).select('-description').sort(sortQuery).skip(skip).limit(limit),
            Product.countDocuments(query)
        ]);

        const responseData = { products, total, page, totalPages: Math.ceil(total / limit) };
        
        await redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
});

// Lightweight read probe — bypasses Redis, hits MongoDB directly.
// Must be declared BEFORE /:id to avoid Express param conflict.
app.get('/ping', async (req, res) => {
    const start = Date.now();
    try {
        await Product.findOne({}).lean();
        res.json({ ok: true, dbLatency: Date.now() - start });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
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
        // Also flush paginated cache keys so the dashboard picks up new products immediately
        const paginatedKeys = await redisClient.keys('products:page:*');
        if (paginatedKeys.length > 0) await redisClient.del(paginatedKeys);
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

app.post('/:productId/comments', async (req, res) => {
    try {
        const { productId } = req.params;
        const commentData = { ...req.body, productId };
        
        // Asynchronous publish, immediately return
        await publishCommentCreatedEvent(commentData);
        res.status(202).json({ message: 'Comment creation accepted and placed in queue' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to queue comment', error });
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

app.get('/:productId/comments', async (req, res) => {
    try {
        const { productId } = req.params;

        // Check Redis list first (populated asynchronously by the COMMENT_CREATED consumer)
        const redisKey = `product:${productId}:comments:recent`;
        const cached = await redisClient.lRange(redisKey, 0, 49);
        if (cached.length > 0) {
            return res.json(cached.map(c => JSON.parse(c)));
        }

        // Cache miss — fall back to MongoDB
        const comments = await Comment.find({ productId }).sort({ createdAt: -1 }).limit(50);
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
});

// DELETE all k6 load-test comments (content starts with "k6 ")
// Must be declared BEFORE /:productId to avoid Express treating "comments" as a productId.
// Called by the k6 teardown() after every test run.
app.delete('/comments/k6', async (req, res) => {
    try {
        const result = await Comment.deleteMany({ content: { $regex: /^k6 / } });
        // Flush all cached comment lists — keys follow pattern product:<id>:comments:recent
        const keys = await redisClient.keys('product:*:comments:recent');
        if (keys.length > 0) await redisClient.del(keys);
        console.log(`[cleanup] Deleted ${result.deletedCount} k6 test comments, flushed ${keys.length} Redis keys`);
        res.json({ message: `Deleted ${result.deletedCount} k6 test comments` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete k6 comments', error });
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
    await consumeCommentCreatedEvents();

    app.listen(PORT, () => {
        console.log(`Product Service running on port ${PORT}`);
    });
};

startServer();
