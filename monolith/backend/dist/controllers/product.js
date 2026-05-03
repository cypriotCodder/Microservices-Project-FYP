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
exports.seedProducts = void 0;
const prisma_1 = require("../config/prisma");
const redis_1 = require("../config/redis");
const seedProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 0. Flush all product-related Redis keys BEFORE touching Postgres.
        //    Without this, the frontend would receive cached products with stale IDs
        //    after the seed deletes and re-inserts with new auto-increment IDs,
        //    causing FK constraint failures when users try to post comments.
        yield redis_1.redisClient.del('products:all');
        const individualKeys = yield redis_1.redisClient.keys('product:*');
        if (individualKeys.length > 0)
            yield redis_1.redisClient.del(individualKeys);
        // 1. Clear existing data (clean slate for the test)
        yield prisma_1.prisma.review.deleteMany({});
        yield prisma_1.prisma.orderItem.deleteMany({});
        yield prisma_1.prisma.order.deleteMany({});
        yield prisma_1.prisma.product.deleteMany({});
        // 2. Define sample products
        const sampleProducts = [
            {
                name: "MacBook Pro M3",
                description: "High performance laptop",
                price: 1999,
                stock: 100,
                image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=1000",
                category: "Electronics"
            },
            {
                name: "iPhone 15",
                description: "Latest smartphone",
                price: 999,
                stock: 5,
                image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80&w=1000",
                category: "Electronics"
            },
            {
                name: "Sony Headphones",
                description: "Noise cancelling",
                price: 299,
                stock: 0,
                image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=1000",
                category: "Electronics"
            }
        ];
        // 3. Insert into PostgreSQL via Prisma
        yield prisma_1.prisma.product.createMany({ data: sampleProducts });
        // Fetch back so we can return them with their assigned IDs
        const insertedProducts = yield prisma_1.prisma.product.findMany({ orderBy: { id: 'asc' } });
        res.status(201).json({
            message: "Database seeded successfully!",
            products: insertedProducts
        });
    }
    catch (error) {
        res.status(500).json({ error: "Seeding failed", details: error });
    }
});
exports.seedProducts = seedProducts;
