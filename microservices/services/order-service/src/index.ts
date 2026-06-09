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

// Per-request timeout: if any handler takes >10s, abort the response.
// Prevents a single slow Mongo write from holding a connection forever.
app.use((req, res, next) => {
    res.setTimeout(10000, () => {
        if (!res.headersSent) {
            res.status(503).json({ error: 'Request timed out' });
        }
    });
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'Order Service is running' });
});

const startServer = async () => {
    await connectDB();

    // CONNECT TO RABBITMQ
    await connectToRabbitMQ();

    const server = app.listen(PORT, () => {
        console.log(`Order Service running on port ${PORT}`);
    });

    // Close idle keep-alive connections quickly after load tests end.
    // Without this, hundreds of sockets linger and the event loop stalls.
    // Under load, this must be larger than proxy timeouts to avoid ECONNRESET and request aborted errors.
    server.keepAliveTimeout = 65000;   // 65s keep-alive
    server.headersTimeout = 66000;     // must be > keepAliveTimeout
    server.maxConnections = 2000;      // increased hard cap on concurrent connections
};

app.use("/", orderRoutes);

startServer();
