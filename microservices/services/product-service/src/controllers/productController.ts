import { Request, Response } from "express";
import { Product } from "../models/product";

export const seedProducts = async (req: Request, res: Response) => {
    try {
        // 1. Clear existing data (Clean slate for the test)
        await Product.deleteMany({});

        // 2. Define dummy data
        const sampleProducts = [
            {
                _id: "65bf73e93409110012345678", // Hardcoded ID for easy testing in Postman
                name: "MacBook Pro M3",
                description: "High performance laptop",
                price: 1999,
                stock: 100, // PLENTY of stock
                image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=1000",
                category: "Electronics"
            },
            {
                _id: "65bf73e93409110087654321",
                name: "iPhone 15",
                description: "Latest smartphone",
                price: 999,
                stock: 5, // LOW stock - good for testing 'race conditions'
                image: "",
                category: "Electronics"
            },
            {
                _id: "65bf73e93409110000000000",
                name: "Sony Headphones",
                description: "Noise cancelling",
                price: 299,
                stock: 0, // NO stock - should fail immediately
                image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=1000",
                category: "Electronics"
            }
        ];

        // 3. Insert into DB
        console.log("Attempting to seed with:", JSON.stringify(sampleProducts, null, 2));
        await Product.insertMany(sampleProducts);

        res.status(201).json({
            message: "Database seeded successfully!",
            products: sampleProducts
        });
    } catch (error) {
        res.status(500).json({ error: "Seeding failed", details: error });
    }
};