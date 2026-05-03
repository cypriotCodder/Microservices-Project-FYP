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
const requireAuth_1 = require("../middleware/requireAuth");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});
// GET admin order metrics
router.get('/admin/metrics', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cachedMetrics = yield redis_1.redisClient.get('admin:metrics');
        if (cachedMetrics) {
            return res.json(JSON.parse(cachedMetrics));
        }
        const totalOrders = yield prisma_1.prisma.order.count();
        const revenueAgg = yield prisma_1.prisma.order.aggregate({ _sum: { totalAmount: true } });
        const totalRevenue = revenueAgg._sum.totalAmount || 0;
        // Top products by units sold
        const topProductsRaw = yield prisma_1.prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10
        });
        const topProducts = yield Promise.all(topProductsRaw.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            const product = yield prisma_1.prisma.product.findUnique({ where: { id: item.productId } });
            return {
                _id: item.productId,
                name: (product === null || product === void 0 ? void 0 : product.name) || 'Unknown Product',
                price: product === null || product === void 0 ? void 0 : product.price,
                totalSold: item._sum.quantity || 0
            };
        })));
        // Orders per minute in the last hour (raw SQL for time-bucket grouping)
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);
        const ordersPerMinute = yield prisma_1.prisma.$queryRaw `
            SELECT
                DATE_TRUNC('minute', "createdAt") AS "_id",
                COUNT(*)::int AS count
            FROM "Order"
            WHERE "createdAt" >= ${lastHour}
            GROUP BY DATE_TRUNC('minute', "createdAt")
            ORDER BY "_id" ASC
        `;
        const payload = { totalOrders, totalRevenue, topProducts, ordersPerMinute };
        yield redis_1.redisClient.setEx('admin:metrics', 15, JSON.stringify(payload));
        res.json(payload);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin order metrics' });
    }
}));
// GET orders for a specific user
router.get('/:userId', requireAuth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        const currentUserId = String(req.user.sub);
        if (userId !== currentUserId) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const orders = yield prisma_1.prisma.order.findMany({
            where: { userId: req.params.userId },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error });
    }
}));
// POST create order (add to cart / PENDING)
router.post('/', requireAuth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { totalAmount, products } = req.body;
    const userId = String(req.user.sub);
    try {
        // Validate all product IDs exist
        const productIds = products.map((p) => parseInt(p.productId));
        const newOrder = yield prisma_1.prisma.order.create({
            data: {
                userId: String(userId),
                totalAmount: parseFloat(totalAmount),
                status: 'PENDING',
                items: {
                    create: products.map((p) => ({
                        productId: parseInt(p.productId),
                        quantity: parseInt(p.quantity)
                    }))
                }
            },
            include: { items: true }
        });
        res.status(201).json({ message: 'Order created', order: newOrder });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
}));
// DELETE single order (and refund stock)
router.delete('/:id', requireAuth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId))
            return res.status(400).json({ message: 'Invalid order ID' });
        const order = yield prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order)
            return res.status(404).json({ message: 'Order not found' });
        if (order.userId !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Forbidden: You do not own this order' });
        }
        // Refund stock ONLY if the order was completed (since pending orders don't decrement stock)
        if (order.status === 'COMPLETED') {
            for (const item of order.items) {
                yield prisma_1.prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
                yield redis_1.redisClient.del(`product:${item.productId}`);
            }
            yield redis_1.redisClient.del('products:all');
        }
        yield prisma_1.prisma.order.delete({ where: { id: orderId } }); // cascade deletes OrderItems
        res.status(200).json({ message: 'Order deleted and stock refunded' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete order', error });
    }
}));
// DELETE all orders for a user (and refund stock)
router.delete('/all/:userId', requireAuth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        if (userId !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const orders = yield prisma_1.prisma.order.findMany({
            where: { userId },
            include: { items: true }
        });
        let stockRefunded = false;
        for (const order of orders) {
            if (order.status === 'COMPLETED') {
                for (const item of order.items) {
                    yield prisma_1.prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    });
                    yield redis_1.redisClient.del(`product:${item.productId}`);
                    stockRefunded = true;
                }
            }
        }
        if (stockRefunded) {
            yield redis_1.redisClient.del('products:all');
        }
        yield prisma_1.prisma.order.deleteMany({ where: { userId } });
        res.status(200).json({ message: 'All orders deleted and stock refunded' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete all orders', error });
    }
}));
// POST finalize purchase (checkout / COMPLETED)
router.post('/:id/buy', requireAuth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId))
            return res.status(400).json({ message: 'Invalid order ID' });
        const order = yield prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order)
            return res.status(404).json({ message: 'Order not found' });
        if (order.userId !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Forbidden: You do not own this order' });
        }
        if (order.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Order is already completed' });
        }
        // Verify stock and decrement for each item
        for (const item of order.items) {
            const product = yield prisma_1.prisma.product.findUnique({ where: { id: item.productId } });
            if (!product) {
                return res.status(400).json({ message: `Product ${item.productId} not found` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for product ${product.name}` });
            }
        }
        for (const item of order.items) {
            yield prisma_1.prisma.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
            yield redis_1.redisClient.del(`product:${item.productId}`);
        }
        yield redis_1.redisClient.del('products:all');
        const updatedOrder = yield prisma_1.prisma.order.update({
            where: { id: orderId },
            data: { status: 'COMPLETED' }
        });
        res.status(200).json({ message: 'Order completed and products removed', order: updatedOrder });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to complete checkout', error });
    }
}));
exports.default = router;
