import './tracing';
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

app.use("/", orderRoutes);

startServer();
