import './tracing';
import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Recommendation Service is running' });
});

app.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Fetch personalized recommendations for this specific user
        const recommendations = await prisma.recommendation.findMany({
            where: { userId },
            orderBy: { score: 'desc' },
            take: 5
        });

        // If no personal history yet, fall back to globally trending items
        // (products clicked most by ANY user — always uses real product IDs)
        if (recommendations.length === 0) {
            const trending = await prisma.recommendation.findMany({
                orderBy: { score: 'desc' },
                take: 5,
                distinct: ['productId'],
            });

            return res.json({
                userId,
                message: trending.length > 0
                    ? "Showing trending items based on community activity"
                    : "No recommendations yet — explore the catalog to personalise your feed",
                recommendations: trending.map(r => ({ productId: r.productId, score: r.score }))
            });
        }

        res.json({ userId, recommendations });
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/click', async (req, res) => {
    // Endpoint to track user clicks/views on products
    const { userId, productId } = req.body;
    try {
        // Always coerce to String — auth service returns userId as Int (Postgres),
        // but the Recommendation schema stores userId as String.
        const uid = String(userId);
        const pid = String(productId);

        const existingRec = await prisma.recommendation.findFirst({
            where: { userId: uid, productId: pid }
        });

        if (existingRec) {
            // Increment score by 1 for an additional click/view
            const updatedRec = await prisma.recommendation.update({
                where: { id: existingRec.id },
                data: { score: existingRec.score + 1 }
            });
            return res.status(200).json(updatedRec);
        } else {
            // New interaction gets a score of 1
            const newRec = await prisma.recommendation.create({
                data: { userId: uid, productId: pid, score: 1 }
            });
            return res.status(201).json(newRec);
        }
    } catch (error) {
        console.error("Error tracking product click:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/', async (req, res) => {
    // Endpoint to seed/add recommendations (e.g. from Python ML service)
    const { userId, productId, score } = req.body;
    try {
        const rec = await prisma.recommendation.create({
            data: { userId, productId, score }
        });
        res.status(201).json(rec);
    } catch (error) {
        console.error("Error creating recommendation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.listen(PORT, () => {
    console.log(`Recommendation Service running on port ${PORT}`);
});
