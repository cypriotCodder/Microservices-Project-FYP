import { Request, Response, NextFunction } from 'express';
import { telemetryMiddleware, getAggregatedMetrics } from '../telemetry';

describe('Telemetry Middleware', () => {
    it('should aggregate successful requests correctly', async () => {
        const req = {} as Request;
        const res = {
            statusCode: 200,
            on: jest.fn((event, callback) => callback())
        } as unknown as Response;

        const next = jest.fn() as NextFunction;

        // Simulate 5 requests
        for (let i = 0; i < 5; i++) {
            telemetryMiddleware(req, res, next);
        }

        const metrics = getAggregatedMetrics();
        expect(metrics.totalRequestsLast60s).toBe(5);
        expect(metrics.errorRate4xx).toBe(0);
        expect(metrics.errorRate5xx).toBe(0);
        expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should correctly bucket 4xx and 5xx errors into telemetry data', async () => {
        const req = {} as Request;
        const res400 = { statusCode: 404, on: jest.fn((event, callback) => callback()) } as unknown as Response;
        const res500 = { statusCode: 500, on: jest.fn((event, callback) => callback()) } as unknown as Response;
        const next = jest.fn() as NextFunction;

        telemetryMiddleware(req, res400, next);
        telemetryMiddleware(req, res400, next);
        telemetryMiddleware(req, res500, next);

        const metrics = getAggregatedMetrics();
        // Since the previous test added 5, total is 8
        expect(metrics.totalRequestsLast60s).toBe(8);
        expect(metrics.errorRate4xx).toBe(25); // 2 out of 8 is 25%
        expect(metrics.errorRate5xx).toBe(12.5); // 1 out of 8 is 12.5%
    });
});
