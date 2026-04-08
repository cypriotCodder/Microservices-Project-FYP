import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { getAggregatedMetrics } from '../middleware/telemetry';
import { prisma } from '../config/prisma';

const router = Router();

router.get('/metrics', requireAdmin, async (req, res) => {
    try {
        // 1. Total users
        const totalUsers = await prisma.user.count();

        // 2. Order metrics
        const totalOrders = await prisma.order.count();

        const revenueAgg = await prisma.order.aggregate({ _sum: { totalAmount: true } });
        const totalRevenue = revenueAgg._sum.totalAmount || 0;

        // 3. Top products by units sold
        const topProductsRaw = await prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10
        });

        const enrichedTopProducts = await Promise.all(
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

        // 4. Orders per minute (last hour) — raw SQL for time-bucket grouping
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

        // 5. Telemetry
        const systemTelemetry = getAggregatedMetrics();

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

// POST /admin/seed-users — create 50 k6 test accounts
// curl -X POST http://localhost:4000/admin/seed-users
router.post('/seed-users', async (req, res) => {
    try {
        const bcrypt = await import('bcrypt');
        const hash = await bcrypt.hash('password123', 10); // one hash, reused for all
        let created = 0;
        let skipped = 0;
        for (let i = 0; i < 50; i++) {
            const username = `user${i}@test.com`;
            const existing = await prisma.user.findUnique({ where: { username } });
            if (existing) { skipped++; continue; }
            await prisma.user.create({ data: { username, password: hash } });
            created++;
        }
        res.json({ message: `Seeded ${created} users (${skipped} already existed)` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to seed users', details: String(error) });
    }
});

export default router;
