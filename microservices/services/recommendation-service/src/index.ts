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

app.get('/recommendations/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Simple logic: return recent recommendations for this user
        // In a real app, this would be complex ML model output stored in DB
        const recommendations = await prisma.recommendation.findMany({
            where: { userId },
            orderBy: { score: 'desc' },
            take: 5
        });

        // If no specific recommendations, return default/fallback (mocked for now)
        if (recommendations.length === 0) {
            return res.json({
                userId,
                message: "No personalized recommendations yet, showing popular items",
                recommendations: [
                    { productId: '101', score: 0.9 },
                    { productId: '102', score: 0.8 }
                ]
            });
        }

        res.json({ userId, recommendations });
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/recommendations', async (req, res) => {
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
