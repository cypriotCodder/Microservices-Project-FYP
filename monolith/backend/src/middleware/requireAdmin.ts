import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        // Assert token expiration explicitly
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ message: 'Unauthorized: Token expired' });
        }

        if (decoded.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }

        // Attach user info to request if downstream logic needs it
        (req as any).user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token signature' });
    }
};
