import './tracing';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { telemetryMiddleware } from './middleware/telemetry';
import adminRoutes from './routes/admin';
import { authMiddleware } from './middleware/authMiddleware';
import { createCircuitBreakerProxy } from './utils/CircuitBreaker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(telemetryMiddleware);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'API Gateway is running' });
});

// Proxy routes wrapped with Circuit Breakers
app.use('/auth', createCircuitBreakerProxy({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
}));

// Protected proxies (Auth Middleware allows GETs implicitly)
app.use('/products', authMiddleware, createCircuitBreakerProxy({
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/products': '' },
}));

app.use('/orders', authMiddleware, createCircuitBreakerProxy({
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/orders': '' },
}));

app.use('/recommendations', authMiddleware, createCircuitBreakerProxy({
    target: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/recommendations': '' },
}));

app.use('/llm', authMiddleware, createCircuitBreakerProxy({
    target: process.env.LLM_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true,
    pathRewrite: { '^/llm': '' },
}));

app.use('/content', authMiddleware, createCircuitBreakerProxy({
    target: process.env.CONTENT_CREATOR_URL || 'http://content-creator:3008',
    changeOrigin: true,
    pathRewrite: { '^/content': '' },
}));

app.use('/traffic', createCircuitBreakerProxy({
    target: process.env.TRAFFIC_SERVICE_URL || 'http://traffic-service:3007',
    changeOrigin: true,
    pathRewrite: { '^/traffic': '' }
}));

app.use('/admin', authMiddleware, adminRoutes);

app.listen(PORT, () => {
    console.log(`Enterprise API Gateway running on port ${PORT}`);
});
