import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { redisClient } from "../config/redis";

export const seedProducts = async (req: Request, res: Response) => {
    try {
        // 0. Flush all product-related Redis keys BEFORE touching Postgres.
        //    Without this, the frontend would receive cached products with stale IDs
        //    after the seed deletes and re-inserts with new auto-increment IDs,
        //    causing FK constraint failures when users try to post comments.
        await redisClient.del('products:all');
        const individualKeys = await redisClient.keys('product:*');
        if (individualKeys.length > 0) await redisClient.del(individualKeys);

        // 1. Clear existing data (clean slate for the test)
        await prisma.review.deleteMany({});
        await prisma.orderItem.deleteMany({});
        await prisma.order.deleteMany({});
        await prisma.product.deleteMany({});

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
        await prisma.product.createMany({ data: sampleProducts });

        // Fetch back so we can return them with their assigned IDs
        const insertedProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });

        res.status(201).json({
            message: "Database seeded successfully!",
            products: insertedProducts
        });
    } catch (error) {
        res.status(500).json({ error: "Seeding failed", details: error });
    }
};