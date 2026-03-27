import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { getAggregatedMetrics } from '../middleware/telemetry';
import { prisma } from '../config/prisma';
import { Order } from '../models/orders';
import { Product } from '../models/products';

const router = Router();

router.get('/metrics', requireAdmin, async (req, res) => {
    try {
        // 1. Fetch total users
        let totalUsers = 0;
        try {
            totalUsers = await prisma.user.count();
        } catch (e) { console.error('Failed to fetch user count in monolith', e); }

        // 2. Fetch order metrics
        let totalOrders = 0;
        let totalRevenue = 0;
        let topProductsRaw: any[] = [];
        let ordersPerMinute: any[] = [];

        try {
            totalOrders = await Order.countDocuments();

            const revenueAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]);
            totalRevenue = revenueAgg[0]?.total || 0;

            topProductsRaw = await Order.aggregate([
                { $unwind: "$products" },
                { $group: { _id: "$products.productId", totalSold: { $sum: "$products.quantity" } } },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]);

            const lastHour = new Date(Date.now() - 60 * 60 * 1000);
            ordersPerMinute = await Order.aggregate([
                { $match: { createdAt: { $gte: lastHour } } },
                {
                    $group: {
                        _id: { $dateTrunc: { date: "$createdAt", unit: "minute" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        } catch (e) { console.error('Failed to fetch order metrics in monolith', e); }

        // 3. Fetch product details for top products to map names and prices natively
        const enrichedTopProducts = [];
        for (const item of topProductsRaw) {
            try {
                const prod = await Product.findById(item._id);
                if (prod) {
                    enrichedTopProducts.push({
                        _id: item._id,
                        name: prod.name,
                        price: prod.price,
                        totalSold: item.totalSold
                    });
                } else {
                    enrichedTopProducts.push({ _id: item._id, name: 'Unknown Product', totalSold: item.totalSold });
                }
            } catch (e) {
                enrichedTopProducts.push({ _id: item._id, name: 'Error Fetching', totalSold: item.totalSold });
            }
        }

        // 4. Extract own telemetry metrics
        const systemTelemetry = getAggregatedMetrics();

        // 5. Combine and send payload structurally identical to API Gateway Payload
        res.json({
            users: totalUsers,
            orders: totalOrders,
            revenue: totalRevenue,
            topProducts: enrichedTopProducts,
            chartData: ordersPerMinute,
            telemetry: systemTelemetry
        });

    } catch (error) {
        console.error('Monolith Admin Metrics Error:', error);
        res.status(500).json({ error: 'Failed to aggregate admin metrics' });
    }
});

export default router;
