import { Router } from 'express';
import { Product } from '../models/products';
import { Order } from '../models/orders';
import { redisClient } from '../config/redis';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});

router.get('/admin/metrics', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();

        const revenueAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]);
        const totalRevenue = revenueAgg[0]?.total || 0;

        const topProducts = await Order.aggregate([
            { $unwind: "$products" },
            { $group: { _id: "$products.productId", totalSold: { $sum: "$products.quantity" } } },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        const lastHour = new Date(Date.now() - 60 * 60 * 1000);
        const ordersPerMinute = await Order.aggregate([
            { $match: { createdAt: { $gte: lastHour } } },
            {
                $group: {
                    _id: { $dateTrunc: { date: "$createdAt", unit: "minute" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({ totalOrders, totalRevenue, topProducts, ordersPerMinute });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch admin order metrics" });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const orders = await Order.find({ userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error });
    }
});

router.post('/', async (req, res) => {
    const { userId, totalAmount, products } = req.body;

    try {
        // 1. Save order to database as PENDING (Items added to cart)
        const newOrder = await Order.create({
            userId,
            totalAmount,
            products,
            status: 'PENDING'
        });

        res.status(201).json({ message: 'Order created', order: newOrder });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Refund stock for each product in the monolith synchronously
        if (order.products && Array.isArray(order.products)) {
            for (const item of order.products) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: item.quantity } }
                );
                await redisClient.del(`product:${item.productId}`);
            }
            await redisClient.del('products:all');
        }

        await Order.findByIdAndDelete(orderId);

        res.status(200).json({ message: 'Order deleted and stock refunded' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete order', error });
    }
});

router.delete('/all/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const orders = await Order.find({ userId });

        // Refund stock for each product in each order in the monolith synchronously
        let stockRefunded = false;
        for (const order of orders) {
            if (order.products && Array.isArray(order.products)) {
                for (const item of order.products) {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { stock: item.quantity } }
                    );
                    await redisClient.del(`product:${item.productId}`);
                    stockRefunded = true;
                }
            }
        }
        if (stockRefunded) {
             await redisClient.del('products:all');
        }

        await Order.deleteMany({ userId });

        res.status(200).json({ message: 'All orders deleted and stock refunded' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete all orders', error });
    }
});

router.post('/:id/buy', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Order is already completed' });
        }

        // Finalize purchase: Decrement stock from the marketplace catalog
        if (order.products && Array.isArray(order.products)) {
            for (const item of order.products) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: -item.quantity } }
                );
                await redisClient.del(`product:${item.productId}`);
            }
            await redisClient.del('products:all');
        }

        // Mark the cart order as officially bought
        order.status = 'COMPLETED';
        await order.save();

        res.status(200).json({ message: 'Order completed and products removed', order });
    } catch (error) {
        res.status(500).json({ message: 'Failed to complete checkout', error });
    }
});

export default router;
