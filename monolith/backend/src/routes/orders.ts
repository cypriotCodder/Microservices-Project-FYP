import { Router } from 'express';
import { Product } from '../models/products';
import { Order } from '../models/orders';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});

router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error });
    }
});

router.post('/', async (req, res) => {
    const { userId, totalAmount, products } = req.body;

    try {
        // 1. Save order to database
        const newOrder = await Order.create({
            userId,
            totalAmount,
            products,
            status: 'PENDING'
        });

        // 2. Directly decrement stock in the same request for monolith
        if (products && Array.isArray(products)) {
            for (const item of products) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: -item.quantity } }
                );
            }
        }
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
            }
        }

        await Order.findByIdAndDelete(orderId);

        res.status(200).json({ message: 'Order deleted and stock refunded' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete order', error });
    }
});

export default router;
