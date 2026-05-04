import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Allow CORS preflights without authentication
    if (req.method === 'OPTIONS') {
        return next();
    }

    // Exempt specific exact paths like auth routes
    if (req.path.startsWith('/auth/register') || req.path.startsWith('/auth/login') || req.path.startsWith('/auth/seed-users')) {
        return next();
    }

    // Exempt k6 test-data cleanup endpoint (no user context needed — internal use only)
    // Note: when mounted under app.use('/products', ...), req.path is the sub-path /comments/k6
    if ((req.path === '/comments/k6' || req.path === '/products/comments/k6') && req.method === 'DELETE') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (req.method === 'GET') {
            return next(); // Allow public GET requests if no token is provided
        }
        res.status(401).json({ message: 'Unauthorized: Missing or invalid token format' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach the decoded context downstream via custom headers
        // Gateway drops internal representation and forwards stringified context
        req.headers['x-user-id'] = String((decoded as any).sub);
        req.headers['x-user-role'] = (decoded as any).role;
        next();
    } catch (error) {
        if (req.method === 'GET') {
            // For public GET requests, just ignore the invalid token and proceed anonymously
            return next();
        }
        console.error('API Gateway Auth Error:', error);
        res.status(403).json({ message: 'Forbidden: Invalid or expired token' });
        return;
    }
};
