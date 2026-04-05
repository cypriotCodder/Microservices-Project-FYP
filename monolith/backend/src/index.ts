import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter as authRoutes } from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import recommendationRoutes from './routes/recommendations';
import llmRoutes from './routes/llm';
import contentRoutes from './routes/content';
import { seedProducts } from './controllers/product';
import { telemetryMiddleware } from './middleware/telemetry';
import adminRoutes from './routes/admin';
import trafficRoutes from './routes/traffic';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(telemetryMiddleware);

// Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/recommendations', recommendationRoutes);
app.use('/llm', llmRoutes);
app.use('/content', contentRoutes);
app.post('/seed', seedProducts);
app.use('/admin', adminRoutes);
app.use('/traffic', trafficRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'Monolith Backend is running', db: 'PostgreSQL' });
});

app.listen(PORT, async () => {
    await connectRedis();
    console.log(`🚀 Monolith Backend running on port ${PORT}`);
    console.log(`🐘 Database: PostgreSQL (Prisma)`);
});
