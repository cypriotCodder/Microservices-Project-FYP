import express from 'express';
import dotenv from 'dotenv';
import { connectToRabbitMQ } from "./utils/messageBroker";
import connectDB from "./config/db";
import orderRoutes from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Order Service is running' });
});

const startServer = async () => {
    await connectDB();

    // CONNECT TO RABBITMQ
    await connectToRabbitMQ();

    app.listen(PORT, () => {
        console.log(`Order Service running on port ${PORT}`);
    });
};

app.get('/', (req, res) => {
    res.json(createOrder);
});

app.post('/', (req, res) => {
    const order = req.body;
    res.status(201).json({ message: 'Order created', order });
    //update the database
    const { productId, quantity } = order;
    //Product.updateOne({ _id: productId }, { $inc: { stock: -quantity } });
});

app.use("/api/orders", orderRoutes);

startServer();
