import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import dotenv from 'dotenv';
import { telemetryMiddleware } from './middleware/telemetry';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(telemetryMiddleware);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'API Gateway is running' });
});

// Proxy routes
// Note: addresses will be mapped in docker-compose, using service names
app.use('/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: {
        '^/auth': '', // remove base path
    },
}));

app.use('/products', createProxyMiddleware({
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: {
        '^/products': '',
    },
}));

app.use('/orders', createProxyMiddleware({
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: {
        '^/orders': '',
    },
}));

app.use('/recommendations', createProxyMiddleware({
    target: process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: {
        '^/recommendations': '',
    },
}));

app.use('/llm', createProxyMiddleware({
    target: process.env.LLM_SERVICE_URL || 'http://localhost:3005',
    changeOrigin: true,
    pathRewrite: {
        '^/llm': '',
    },
}));

app.use('/content', createProxyMiddleware({
    target: process.env.CONTENT_CREATOR_URL || 'http://content-creator:3008',
    changeOrigin: true,
    pathRewrite: {
        '^/content': '',
    },
}));

app.use('/traffic', createProxyMiddleware({
    target: process.env.TRAFFIC_SERVICE_URL || 'http://traffic-service:3007',
    changeOrigin: true
}));

app.use('/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
