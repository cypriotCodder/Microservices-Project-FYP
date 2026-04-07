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
const requireAdmin_1 = require("../middleware/requireAdmin");
const telemetry_1 = require("../middleware/telemetry");
const prisma_1 = require("../config/prisma");
const router = (0, express_1.Router)();
router.get('/metrics', requireAdmin_1.requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Total users
        const totalUsers = yield prisma_1.prisma.user.count();
        // 2. Order metrics
        const totalOrders = yield prisma_1.prisma.order.count();
        const revenueAgg = yield prisma_1.prisma.order.aggregate({ _sum: { totalAmount: true } });
        const totalRevenue = revenueAgg._sum.totalAmount || 0;
        // 3. Top products by units sold
        const topProductsRaw = yield prisma_1.prisma.orderItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 10
        });
        const enrichedTopProducts = yield Promise.all(topProductsRaw.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            const product = yield prisma_1.prisma.product.findUnique({ where: { id: item.productId } });
            return {
                _id: item.productId,
                name: (product === null || product === void 0 ? void 0 : product.name) || 'Unknown Product',
                price: product === null || product === void 0 ? void 0 : product.price,
                totalSold: item._sum.quantity || 0
            };
        })));
        // 4. Orders per minute (last hour) — raw SQL for time-bucket grouping
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
        // 5. Telemetry
        const systemTelemetry = (0, telemetry_1.getAggregatedMetrics)();
        res.json({
            users: totalUsers,
            orders: totalOrders,
            revenue: totalRevenue,
            topProducts: enrichedTopProducts,
            chartData: ordersPerMinute,
            telemetry: systemTelemetry
        });
    }
    catch (error) {
        console.error('Monolith Admin Metrics Error:', error);
        res.status(500).json({ error: 'Failed to aggregate admin metrics' });
    }
}));
exports.default = router;
