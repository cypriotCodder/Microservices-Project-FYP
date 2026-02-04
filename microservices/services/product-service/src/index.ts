import express from 'express';
import dotenv from 'dotenv';
import { Product } from './models/product';
import { seedProducts } from "./controllers/productController";
import connectDB from './config/db';

dotenv.config();

connectDB();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});

app.get('/', async (req, res) => {
    // fetch from the db
    const products = await Product.find();

    res.json(products);
});

app.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});

app.post('/seed', seedProducts);

app.listen(PORT, () => {
    console.log(`Product Service running on port ${PORT}`);
});
