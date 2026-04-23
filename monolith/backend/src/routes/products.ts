import { Router } from 'express';
import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});

// GET all products (paginated and filtered)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const category = req.query.category as string || "All";
        const sort = req.query.sort as string || "";

        // Predictable 60s cache block mimicking microservices flow
        const cacheKey = `products:page:${page}:limit:${limit}:cat:${category}:sort:${sort}`;
        const cachedProducts = await redisClient.get(cacheKey);
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }

        let whereClause: any = {};
        if (category !== "All") {
            whereClause.category = category;
        }

        let orderByClause: any = { createdAt: 'desc' };
        if (sort === 'price-asc') orderByClause = { price: 'asc' };
        if (sort === 'price-desc') orderByClause = { price: 'desc' };
        if (sort === 'name-asc') orderByClause = { name: 'asc' };
        if (sort === 'name-desc') orderByClause = { name: 'desc' };

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    image: true,
                    category: true
                },
                orderBy: orderByClause,
                skip: skip,
                take: limit
            }),
            prisma.product.count({ where: whereClause })
        ]);

        const responseData = { products, total, page, totalPages: Math.ceil(total / limit) };
        await redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
});

// Lightweight read probe — bypasses Redis, hits Postgres directly.
// Used by k6 PingDB iterations to measure raw DB latency and make
// connection pool exhaustion visible as a latency spike at ~200 VUs.
// Must be declared BEFORE /:id to avoid Express param conflict.
router.get('/ping', async (req, res) => {
    const start = Date.now();
    try {
        await prisma.product.findFirst({});
        res.json({ ok: true, dbLatency: Date.now() - start });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ message: 'Invalid product ID' });

        const cacheKey = `product:${id}`;
        const cachedProduct = await redisClient.get(cacheKey);
        if (cachedProduct) {
            return res.json(JSON.parse(cachedProduct));
        }

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        await redisClient.setEx(cacheKey, 3600, JSON.stringify(product));
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
});

// POST create product
router.post('/', async (req, res) => {
    try {
        const { name, price, description, stock, image, category } = req.body;
        const product = await prisma.product.create({
            data: { name, price: parseFloat(price), description, stock: parseInt(stock) || 0, image, category }
        });
        await redisClient.del('products:all');
        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
});

// DELETE all products (and their reviews via cascade)
router.delete('/all', async (req, res) => {
    try {
        await prisma.review.deleteMany({});
        await prisma.orderItem.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.product.deleteMany({});
        await redisClient.del('products:all');
        res.json({ message: 'All products, reviews, and orders seamlessly wiped from database' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete products', error });
    }
});

// POST create review for a product
router.post('/:productId/reviews', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) return res.status(400).json({ message: 'Invalid product ID' });

        const { userId, title, content, rating } = req.body;
        const review = await prisma.review.create({
            data: { productId, userId, title, content, rating: parseInt(rating) }
        });
        res.status(201).json({ message: 'Review created', review });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create review', error });
    }
});

// GET reviews for a product
router.get('/:productId/reviews', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) return res.status(400).json({ message: 'Invalid product ID' });

        const reviews = await prisma.review.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
});

// GET comments for a product (Synchronous read)
router.get('/:productId/comments', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) return res.status(400).json({ message: 'Invalid product ID' });

        const comments = await prisma.comment.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
});

// POST create comment for a product (Synchronous - intentionally bottlenecked)
router.post('/:productId/comments', async (req, res) => {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId)) return res.status(400).json({ message: 'Invalid product ID' });

        const { userId, content } = req.body;
        const comment = await prisma.comment.create({
            data: { productId, userId: String(userId), content }
        });
        res.status(201).json({ message: 'Comment created', comment });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create comment', error });
    }
});

export default router;
