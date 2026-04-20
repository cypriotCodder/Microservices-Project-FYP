import { Request, Response, NextFunction } from 'express';
import { Options, createProxyMiddleware } from 'http-proxy-middleware';

enum BreakerState {
    CLOSED = 'CLOSED',       // Normal operation
    OPEN = 'OPEN',           // Failing, short-circuiting
    HALF_OPEN = 'HALF_OPEN'  // Testing recovery
}

export class CircuitBreaker {
    private state: BreakerState = BreakerState.CLOSED;
    private failureThreshold: number;
    private resetTimeout: number; // in milliseconds
    
    private failureCount: number = 0;
    private nextAttemptTime: number = 0;

    constructor(failureThreshold: number = 5, resetTimeout: number = 30000) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
    }

    public recordFailure(): void {
        this.failureCount++;
        if (this.state === BreakerState.CLOSED && this.failureCount >= this.failureThreshold) {
            this.tripBreaker();
        } else if (this.state === BreakerState.HALF_OPEN) {
            this.tripBreaker();
        }
    }

    public recordSuccess(): void {
        this.failureCount = 0;
        if (this.state === BreakerState.HALF_OPEN) {
            this.state = BreakerState.CLOSED;
            console.log(`[Circuit Breaker] Service recovered. State is now CLOSED`);
        }
    }

    private tripBreaker(): void {
        this.state = BreakerState.OPEN;
        this.nextAttemptTime = Date.now() + this.resetTimeout;
        console.warn(`[Circuit Breaker] Tripped! State is now OPEN for ${this.resetTimeout / 1000}s`);
    }

    public checkState(): BreakerState {
        if (this.state === BreakerState.OPEN) {
            if (Date.now() > this.nextAttemptTime) {
                this.state = BreakerState.HALF_OPEN;
                console.log(`[Circuit Breaker] Entering HALF_OPEN state to test service`);
                return BreakerState.HALF_OPEN;
            }
        }
        return this.state;
    }
}

// Factory to create a proxy wrapped in a circuit breaker
export const createCircuitBreakerProxy = (proxyOptions: Options) => {
    const breaker = new CircuitBreaker();

    // The middleware that intercepts before proxying
    const breakerMiddleware = (req: Request, res: Response, next: NextFunction) => {
        const state = breaker.checkState();
        if (state === BreakerState.OPEN) {
            return res.status(503).json({ 
                error: 'Service Unavailable', 
                message: 'Circuit breaker is OPEN. The downstream service is currently unreachable.' 
            });
        }
        // If HALF_OPEN or CLOSED, allow the request to proceed to the proxy
        next();
    };

    // Enhance proxy options with interceptors
    const enhancedOptions: Options = {
        ...proxyOptions,
        on: {
            error: (err, req, res) => {
                breaker.recordFailure();
                console.error(`[Proxy Error] ${err.message}. Failure count: ${(breaker as any).failureCount}`);
                if (!res.headersSent) {
                   (res as Response).status(502).json({ error: 'Bad Gateway', message: 'The downstream service failed or timed out.' });
                }
            },
            proxyRes: (proxyRes, req, res) => {
                // Any successful proxy connection (even a 404/500 from the microservice app layer itself) 
                // means the network TCP connection is healthy. We only break on network/timeout failures.
                breaker.recordSuccess();
            }
        }
    };

    const proxy = createProxyMiddleware(enhancedOptions);

    // Return combined middleware
    return [breakerMiddleware, proxy];
};
