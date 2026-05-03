"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'Product Module is running' });
});
// GET all products (paginated and filtered)
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const category = req.query.category || "All";
        const sort = req.query.sort || "";
        // Predictable 60s cache block mimicking microservices flow
        const cacheKey = `products:page:${page}:limit:${limit}:cat:${category}:sort:${sort}`;
        const cachedProducts = yield redis_1.redisClient.get(cacheKey);
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }
        let whereClause = {};
        if (category !== "All") {
            whereClause.category = category;
        }
        let orderByClause = { createdAt: 'desc' };
        if (sort === 'price-asc')
            orderByClause = { price: 'asc' };
        if (sort === 'price-desc')
            orderByClause = { price: 'desc' };
        if (sort === 'name-asc')
            orderByClause = { name: 'asc' };
        if (sort === 'name-desc')
            orderByClause = { name: 'desc' };
        const skip = (page - 1) * limit;
        const [products, total] = yield Promise.all([
            prisma_1.prisma.product.findMany({
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
            prisma_1.prisma.product.count({ where: whereClause })
        ]);
        const responseData = { products, total, page, totalPages: Math.ceil(total / limit) };
        yield redis_1.redisClient.setEx(cacheKey, 60, JSON.stringify(responseData));
        res.json(responseData);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
}));
// Lightweight read probe — bypasses Redis, hits Postgres directly.
// Used by k6 PingDB iterations to measure raw DB latency and make
// connection pool exhaustion visible as a latency spike at ~200 VUs.
// Must be declared BEFORE /:id to avoid Express param conflict.
router.get('/ping', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const start = Date.now();
    try {
        yield prisma_1.prisma.product.findFirst({});
        res.json({ ok: true, dbLatency: Date.now() - start });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
}));
// GET single product by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id))
            return res.status(400).json({ message: 'Invalid product ID' });
        const cacheKey = `product:${id}`;
        const cachedProduct = yield redis_1.redisClient.get(cacheKey);
        if (cachedProduct) {
            return res.json(JSON.parse(cachedProduct));
        }
        const product = yield prisma_1.prisma.product.findUnique({ where: { id } });
        if (!product)
            return res.status(404).json({ message: 'Product not found' });
        yield redis_1.redisClient.setEx(cacheKey, 3600, JSON.stringify(product));
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
}));
// POST create product
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, price, description, stock, image, category } = req.body;
        const product = yield prisma_1.prisma.product.create({
            data: { name, price: parseFloat(price), description, stock: parseInt(stock) || 0, image, category }
        });
        yield redis_1.redisClient.del('products:all');
        res.status(201).json({ message: 'Product created', product });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
}));
// DELETE all products (and their reviews via cascade)
router.delete('/all', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield prisma_1.prisma.review.deleteMany({});
        yield prisma_1.prisma.orderItem.deleteMany({});
        yield prisma_1.prisma.order.deleteMany({});
        yield prisma_1.prisma.product.deleteMany({});
        yield redis_1.redisClient.del('products:all');
        res.json({ message: 'All products, reviews, and orders seamlessly wiped from database' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete products', error });
    }
}));
// POST create review for a product
router.post('/:productId/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId))
            return res.status(400).json({ message: 'Invalid product ID' });
        const { userId, title, content, rating } = req.body;
        const review = yield prisma_1.prisma.review.create({
            data: { productId, userId, title, content, rating: parseInt(rating) }
        });
        res.status(201).json({ message: 'Review created', review });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create review', error });
    }
}));
// GET reviews for a product
router.get('/:productId/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId))
            return res.status(400).json({ message: 'Invalid product ID' });
        const reviews = yield prisma_1.prisma.review.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reviews);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
}));
// GET comments for a product (Synchronous read)
router.get('/:productId/comments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId))
            return res.status(400).json({ message: 'Invalid product ID' });
        const comments = yield prisma_1.prisma.comment.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(comments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
}));
// POST create comment for a product (Synchronous - intentionally bottlenecked)
router.post('/:productId/comments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        if (isNaN(productId))
            return res.status(400).json({ message: 'Invalid product ID' });
        const { userId, content } = req.body;
        const comment = yield prisma_1.prisma.comment.create({
            data: { productId, userId: String(userId), content }
        });
        res.status(201).json({ message: 'Comment created', comment });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create comment', error });
    }
}));
exports.default = router;
