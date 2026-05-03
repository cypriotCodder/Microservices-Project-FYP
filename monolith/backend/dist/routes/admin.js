"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const redis_1 = require("../config/redis");
const router = (0, express_1.Router)();
router.get('/metrics', requireAdmin_1.requireAdmin, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cachedAdminMetrics = yield redis_1.redisClient.get('admin:metrics_global');
        if (cachedAdminMetrics) {
            const parsed = JSON.parse(cachedAdminMetrics);
            parsed.telemetry = (0, telemetry_1.getAggregatedMetrics)();
            return res.json(parsed);
        }
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
        // 5. Combine and Set Cache
        const systemTelemetry = (0, telemetry_1.getAggregatedMetrics)();
        const payload = {
            users: totalUsers,
            orders: totalOrders,
            revenue: totalRevenue,
            topProducts: enrichedTopProducts,
            chartData: ordersPerMinute,
        };
        yield redis_1.redisClient.setEx('admin:metrics_global', 15, JSON.stringify(payload));
        // Return active telemetry stitched in
        res.json(Object.assign(Object.assign({}, payload), { telemetry: systemTelemetry }));
    }
    catch (error) {
        console.error('Monolith Admin Metrics Error:', error);
        res.status(500).json({ error: 'Failed to aggregate admin metrics' });
    }
}));
// POST /admin/seed-users — create 50 k6 test accounts
// curl -X POST http://localhost:4000/admin/seed-users
router.post('/seed-users', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bcrypt = yield Promise.resolve().then(() => __importStar(require('bcrypt')));
        const hash = yield bcrypt.hash('password123', 10); // one hash, reused for all
        let created = 0;
        let skipped = 0;
        for (let i = 0; i < 50; i++) {
            const username = `user${i}@test.com`;
            const existing = yield prisma_1.prisma.user.findUnique({ where: { username } });
            if (existing) {
                skipped++;
                continue;
            }
            yield prisma_1.prisma.user.create({ data: { username, password: hash } });
            created++;
        }
        res.json({ message: `Seeded ${created} users (${skipped} already existed)` });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to seed users', details: String(error) });
    }
}));
exports.default = router;
