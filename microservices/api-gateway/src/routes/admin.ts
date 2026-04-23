import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { getAggregatedMetrics } from '../middleware/telemetry';

const router = express.Router();
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

let cachedAdminMetrics: any = null;
let metricsCacheTimestamp = 0;
const METRICS_TTL_MS = 15000;

router.get('/metrics', requireAdmin, async (req, res) => {
    try {
        const now = Date.now();
        if (cachedAdminMetrics && (now - metricsCacheTimestamp < METRICS_TTL_MS)) {
            // Update telemetry dynamically even on cached payloads
            cachedAdminMetrics.telemetry = getAggregatedMetrics();
            return res.json(cachedAdminMetrics);
        }

        // 1. Fetch total users
        let totalUsers = 0;
        try {
            const userRes = await fetch(`${AUTH_URL}/admin/users/count`);
            if (userRes.ok) {
                const userData = await userRes.json();
                totalUsers = userData.count;
            }
        } catch (e) { console.error('Failed to fetch user count'); }

        // 2. Fetch order metrics
        let totalOrders = 0;
        let totalRevenue = 0;
        let topProductsRaw: any[] = [];
        let ordersPerMinute: any[] = [];

        try {
            const orderRes = await fetch(`${ORDER_URL}/admin/metrics`);
            if (orderRes.ok) {
                const orderData = await orderRes.json();
                totalOrders = orderData.totalOrders;
                totalRevenue = orderData.totalRevenue;
                topProductsRaw = orderData.topProducts;
                ordersPerMinute = orderData.ordersPerMinute;
            }
        } catch (e) { console.error('Failed to fetch order metrics'); }

        // 3. Fetch product details for top products to map names and prices
        const enrichedTopProducts = await Promise.all(topProductsRaw.map(async (item: any) => {
            try {
                const prodRes = await fetch(`${PRODUCT_URL}/${item._id}`);
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    return {
                        _id: item._id,
                        name: prodData.name,
                        price: prodData.price,
                        totalSold: item.totalSold
                    };
                } else {
                    return { _id: item._id, name: 'Unknown Product', totalSold: item.totalSold };
                }
            } catch (e) {
                return { _id: item._id, name: 'Error Fetching', totalSold: item.totalSold };
            }
        }));

        // 4. Extract own telemetry metrics
        const systemTelemetry = getAggregatedMetrics();

        // 5. Combine, cache, and send payload
        cachedAdminMetrics = {
            users: totalUsers,
            orders: totalOrders,
            revenue: totalRevenue,
            topProducts: enrichedTopProducts,
            chartData: ordersPerMinute,
            telemetry: systemTelemetry
        };
        metricsCacheTimestamp = now;

        res.json(cachedAdminMetrics);
    } catch (error) {
        console.error('API Gateway Admin Metrics Error:', error);
        res.status(500).json({ error: 'Failed to aggregate admin metrics' });
    }
});

export default router;
