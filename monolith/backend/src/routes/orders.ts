import { Router } from 'express';
import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});

// GET admin order metrics
router.get('/admin/metrics', async (req, res) => {
    try {
        const totalOrders = await prisma.order.count();

        const revenueAgg = await prisma.order.aggregate({ _sum: { totalAmount: true } });
        const totalRevenue = revenueAgg._sum.totalAmount || 0;

        // Top products by units sold
        const topProductsRaw = await prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10
        });

        const topProducts = await Promise.all(
            topProductsRaw.map(async (item) => {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });
                return {
                    _id: item.productId,
                    name: product?.name || 'Unknown Product',
                    price: product?.price,
                    totalSold: item._sum.quantity || 0
                };
            })
        );

        // Orders per minute in the last hour (raw SQL for time-bucket grouping)
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);
        const ordersPerMinute: any[] = await prisma.$queryRaw`
            SELECT
                DATE_TRUNC('minute', "createdAt") AS "_id",
                COUNT(*)::int AS count
            FROM "Order"
            WHERE "createdAt" >= ${lastHour}
            GROUP BY DATE_TRUNC('minute', "createdAt")
            ORDER BY "_id" ASC
        `;

        res.json({ totalOrders, totalRevenue, topProducts, ordersPerMinute });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admin order metrics' });
    }
});

// GET orders for a specific user
router.get('/:userId', async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: req.params.userId },
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error });
    }
});

// POST create order (add to cart / PENDING)
router.post('/', async (req, res) => {
    const { userId, totalAmount, products } = req.body;

    try {
        // Validate all product IDs exist
        const productIds: number[] = products.map((p: any) => parseInt(p.productId));

        const newOrder = await prisma.order.create({
            data: {
                userId: String(userId),
                totalAmount: parseFloat(totalAmount),
                status: 'PENDING',
                items: {
                    create: products.map((p: any) => ({
                        productId: parseInt(p.productId),
                        quantity: parseInt(p.quantity)
                    }))
                }
            },
            include: { items: true }
        });

        res.status(201).json({ message: 'Order created', order: newOrder });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

// DELETE single order (and refund stock)
router.delete('/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) return res.status(400).json({ message: 'Invalid order ID' });

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Refund stock for each item
        for (const item of order.items) {
            await prisma.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } }
            });
            await redisClient.del(`product:${item.productId}`);
        }
        await redisClient.del('products:all');

        await prisma.order.delete({ where: { id: orderId } }); // cascade deletes OrderItems

        res.status(200).json({ message: 'Order deleted and stock refunded' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete order', error });
    }
});

// DELETE all orders for a user (and refund stock)
router.delete('/all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await prisma.order.findMany({
            where: { userId },
            include: { items: true }
        });

        let stockRefunded = false;
        for (const order of orders) {
            for (const item of order.items) {
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } }
                });
                await redisClient.del(`product:${item.productId}`);
                stockRefunded = true;
            }
        }
        if (stockRefunded) {
            await redisClient.del('products:all');
        }

        await prisma.order.deleteMany({ where: { userId } });

        res.status(200).json({ message: 'All orders deleted and stock refunded' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete all orders', error });
    }
});

// POST finalize purchase (checkout / COMPLETED)
router.post('/:id/buy', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) return res.status(400).json({ message: 'Invalid order ID' });

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Order is already completed' });
        }

        // Decrement stock for each item
        for (const item of order.items) {
            await prisma.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
            await redisClient.del(`product:${item.productId}`);
        }
        await redisClient.del('products:all');

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: 'COMPLETED' }
        });

        res.status(200).json({ message: 'Order completed and products removed', order: updatedOrder });
    } catch (error) {
        res.status(500).json({ message: 'Failed to complete checkout', error });
    }
});

export default router;
