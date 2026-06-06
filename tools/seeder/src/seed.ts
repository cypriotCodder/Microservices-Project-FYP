import { PrismaClient, Role } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { connectMongo, Product, Review, Order } from './mongo';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Seeder Configuration Targets 
// (Lowered slightly for testing speed. You can easily bump these integers up significantly for a massive stress test)
const USER_COUNT = 1000;
const PRODUCT_COUNT = 200;
const MAX_REVIEWS_PER_USER = 5;
const MAX_ORDERS_PER_USER = 3;
const MAX_RECOMMENDATIONS_PER_USER = 4;

const seed = async () => {
    console.log('🌱 Starting Database Seeding Process...');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce';
    await connectMongo(mongoUri);

    try {
        // --- 0. Idempotency Check ---
        // Skip seeding if data already exists (prevents wipes on container restart)
        const existingUsers = await prisma.user.count();
        const existingProducts = await Product.countDocuments();

        if (existingUsers > 10 && existingProducts > 10) {
            console.log(`⏭️  Database already seeded (${existingUsers} users, ${existingProducts} products). Skipping.`);
            console.log('   To force a re-seed, clear the databases first.');
            return;
        }

        // --- 1. Clean Existing Databases ---
        console.log('🧹 Formatting existing databases...');
        await prisma.recommendation.deleteMany();
        await prisma.user.deleteMany();

        await Product.deleteMany({});
        await Review.deleteMany({});
        await Order.deleteMany({});
        console.log('✅ Databases formatted.');

        // --- 2. Seed Users (PostgreSQL) ---
        console.log(`👤 Generating ${USER_COUNT} PostgreSQL Users...`);
        const defaultPassword = await bcrypt.hash('password123', 10);

        const userData = Array.from({ length: USER_COUNT }).map((_, index) => ({
            username: index === 0 ? 'admin' : faker.internet.username() + '_' + faker.string.uuid().slice(0, 5),
            password: defaultPassword,
            role: index === 0 ? Role.ADMIN : Role.USER
        }));

        await prisma.user.createMany({
            data: userData,
            skipDuplicates: true
        });

        // Fetch users to get their generated primary keys (Int)
        const dbUsers = await prisma.user.findMany({ select: { id: true, username: true } });
        console.log(`✅ successfully seeded ${dbUsers.length} users.`);

        // --- 3. Seed Products (MongoDB) ---
        console.log(`📦 Generating ${PRODUCT_COUNT} MongoDB Products...`);
        const productData = Array.from({ length: PRODUCT_COUNT }).map(() => ({
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription() + '\\n\\n' + faker.lorem.paragraphs(5, '\\n\\n'),
            price: parseFloat(faker.commerce.price({ min: 10, max: 1000, dec: 2 })),
            stock: faker.number.int({ min: 10, max: 500 }),
            category: faker.commerce.department(),
            image: faker.image.urlLoremFlickr({ category: 'product', width: 400, height: 400 })
        }));

        const dbProducts = await Product.insertMany(productData, { ordered: false });
        console.log(`✅ Successfully seeded ${dbProducts.length} products.`);

        // --- 4. Seed Reviews & Orders (MongoDB) ---
        console.log('✍️ Generating realistic interactions (Reviews, Orders, and Recommendations)...');

        const reviewBatch: any[] = [];
        const orderBatch: any[] = [];
        const recommendationBatch: any[] = [];

        for (const user of dbUsers) {
            const userIdString = String(user.id);
            const numReviews = faker.number.int({ min: 0, max: MAX_REVIEWS_PER_USER });

            // Generate Reviews
            for (let i = 0; i < numReviews; i++) {
                const randomProduct = faker.helpers.arrayElement(dbProducts);
                reviewBatch.push({
                    productId: randomProduct._id.toString(),
                    userId: userIdString,
                    rating: faker.number.int({ min: 1, max: 5 }),
                    comment: faker.lorem.paragraph()
                });
            }

            // Generate Orders
            const numOrders = faker.number.int({ min: 0, max: MAX_ORDERS_PER_USER });
            for (let i = 0; i < numOrders; i++) {
                const randomProduct = faker.helpers.arrayElement(dbProducts);
                const quantity = faker.number.int({ min: 1, max: 3 });
                const orderAmount = randomProduct.price * quantity;

                orderBatch.push({
                    userId: userIdString,
                    products: [{ productId: randomProduct._id.toString(), quantity }],
                    totalAmount: orderAmount,
                    status: faker.helpers.arrayElement(['pending', 'shipped', 'delivered'])
                });

                // Convert Order interactions directly into Recommendations (PostgreSQL)
                // A purchase interaction is a strong semantic signal
                // Check if we haven't already added this to pending batch
                const existingRec = recommendationBatch.find(r => r.userId === userIdString && r.productId === randomProduct._id.toString());
                if (existingRec) {
                    existingRec.score += 5; // purchases heavily increment recommendation score
                } else {
                    recommendationBatch.push({
                        userId: userIdString,
                        productId: randomProduct._id.toString(),
                        score: 5
                    });
                }
            }

            // Pad Recommendations for users who didn't buy much
            const numRecs = faker.number.int({ min: 0, max: MAX_RECOMMENDATIONS_PER_USER });
            for (let i = 0; i < numRecs; i++) {
                const randomProduct = faker.helpers.arrayElement(dbProducts);
                const existingRec = recommendationBatch.find(r => r.userId === userIdString && r.productId === randomProduct._id.toString());
                if (!existingRec) {
                    recommendationBatch.push({
                        userId: userIdString,
                        productId: randomProduct._id.toString(),
                        score: faker.number.int({ min: 1, max: 3 })
                    });
                }
            }
        }

        // Insert Batch Interactions
        console.log(`Inserting ${reviewBatch.length} simulated reviews...`);
        if (reviewBatch.length > 0) await Review.insertMany(reviewBatch, { ordered: false });

        console.log(`Inserting ${orderBatch.length} simulated orders...`);
        if (orderBatch.length > 0) await Order.insertMany(orderBatch, { ordered: false });

        console.log(`Inserting ${recommendationBatch.length} recommendation metric clusters...`);
        if (recommendationBatch.length > 0) {
            await prisma.recommendation.createMany({
                data: recommendationBatch,
                skipDuplicates: true
            });
        }

        console.log('🎉 SEEDING COMPLETE! 🎉');
        console.log('You can tweak the generation variables at the top of src/seed.ts if you want a larger dataset.');

    } catch (e) {
        console.error('❌ SEEDING FAILED', e);
    } finally {
        await prisma.$disconnect();
        await mongoose.disconnect();
        process.exit(0);
    }
};

seed();

