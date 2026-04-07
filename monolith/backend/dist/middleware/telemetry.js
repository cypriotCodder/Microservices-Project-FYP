"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAggregatedMetrics = exports.telemetryMiddleware = void 0;
// 60-bucket ring buffer
const WINDOW_SIZE = 60;
const ringBuffer = Array.from({ length: WINDOW_SIZE }, () => ({
    timestamp: 0, count: 0, errors4xx: 0, errors5xx: 0, latencySum: 0, latencyCount: 0
}));
let headIndex = 0;
function getCurrentBucket() {
    const nowSec = Math.floor(Date.now() / 1000);
    let currentBucket = ringBuffer[headIndex];
    // If the currently pointed bucket is outdated, we need to advance the head
    if (currentBucket.timestamp !== nowSec) {
        // Calculate how many seconds have passed since the last tracked bucket
        const diff = currentBucket.timestamp === 0 ? 1 : nowSec - currentBucket.timestamp;
        // If the gap is massive, just clear the whole buffer
        if (diff >= WINDOW_SIZE) {
            for (let i = 0; i < WINDOW_SIZE; i++) {
                ringBuffer[i] = { timestamp: 0, count: 0, errors4xx: 0, errors5xx: 0, latencySum: 0, latencyCount: 0 };
            }
            headIndex = 0;
            currentBucket = ringBuffer[0];
            currentBucket.timestamp = nowSec;
        }
        else if (diff > 0) {
            // Otherwise, advance head by `diff` steps, clearing old buckets along the way
            for (let i = 1; i <= diff; i++) {
                headIndex = (headIndex + 1) % WINDOW_SIZE;
                ringBuffer[headIndex] = { timestamp: nowSec - diff + i, count: 0, errors4xx: 0, errors5xx: 0, latencySum: 0, latencyCount: 0 };
            }
            currentBucket = ringBuffer[headIndex];
        }
    }
    return currentBucket;
}
const telemetryMiddleware = (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const latencyMs = (diff[0] * 1e9 + diff[1]) / 1e6;
        const status = res.statusCode;
        const bucket = getCurrentBucket();
        bucket.count += 1;
        bucket.latencySum += latencyMs;
        bucket.latencyCount += 1;
        if (status >= 400 && status < 500) {
            bucket.errors4xx += 1;
        }
        else if (status >= 500) {
            bucket.errors5xx += 1;
        }
    });
    next();
};
exports.telemetryMiddleware = telemetryMiddleware;
const getAggregatedMetrics = () => {
    // Ensure the buffer is up to date before reading
    getCurrentBucket();
    const nowSec = Math.floor(Date.now() / 1000);
    let totalCount = 0;
    let total4xx = 0;
    let total5xx = 0;
    let totalLatencySum = 0;
    let totalLatencyCount = 0;
    for (const bucket of ringBuffer) {
        // Only aggregate buckets that are within the last 60 seconds
        if (nowSec - bucket.timestamp < WINDOW_SIZE) {
            totalCount += bucket.count;
            total4xx += bucket.errors4xx;
            total5xx += bucket.errors5xx;
            totalLatencySum += bucket.latencySum;
            totalLatencyCount += bucket.latencyCount;
        }
    }
    const errorRate4xx = totalCount === 0 ? 0 : (total4xx / totalCount) * 100;
    const errorRate5xx = totalCount === 0 ? 0 : (total5xx / totalCount) * 100;
    const avgLatency = totalLatencyCount === 0 ? 0 : (totalLatencySum / totalLatencyCount);
    return {
        totalRequestsLast60s: totalCount,
        errorRate4xx: Number(errorRate4xx.toFixed(2)),
        errorRate5xx: Number(errorRate5xx.toFixed(2)),
        avgLatencyMs: Number(avgLatency.toFixed(2))
    };
};
exports.getAggregatedMetrics = getAggregatedMetrics;
