"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = void 0;
const redis_1 = require("redis");
// Defaults to redis://localhost:6379 natively if not overridden by docker-compose environment vars
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: REDIS_URL
});
exports.redisClient.on('error', (err) => console.error('Redis Client Error', err));
exports.redisClient.on('connect', () => console.log('✅ Connected to Redis successfully'));
const connectRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.redisClient.connect();
    }
    catch (e) {
        console.error('Failed to connect to Redis', e);
    }
});
exports.connectRedis = connectRedis;
