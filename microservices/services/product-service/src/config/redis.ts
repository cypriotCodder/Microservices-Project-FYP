import { createClient } from 'redis';

// Defaults to redis://localhost:6379 natively if not overridden by docker-compose environment vars
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
    url: REDIS_URL
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis successfully'));

export const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (e) {
        console.error('Failed to connect to Redis', e);
    }
};
