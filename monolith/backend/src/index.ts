import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter as authRoutes } from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'Monolith Backend is running' });
});

app.listen(PORT, () => {
    console.log(`Monolith Backend running on port ${PORT}`);
});
