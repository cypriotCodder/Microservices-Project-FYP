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
const product_1 = require("../models/product");
const seedProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Clear existing data (Clean slate for the test)
        yield product_1.Product.deleteMany({});
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
                image: "https://images.unsplash.com/photo-1696446701796-da61225697cc?auto=format&fit=crop&q=80&w=1000",
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
        yield product_1.Product.insertMany(sampleProducts);
        res.status(201).json({
            message: "Database seeded successfully!",
            products: sampleProducts
        });
    }
    catch (error) {
        res.status(500).json({ error: "Seeding failed", details: error });
    }
});
exports.seedProducts = seedProducts;
