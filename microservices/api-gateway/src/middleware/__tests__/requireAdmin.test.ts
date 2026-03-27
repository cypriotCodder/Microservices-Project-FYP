import { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../requireAdmin';
import jwt from 'jsonwebtoken';

describe('requireAdmin Middleware', () => {
    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
    });

    it('should return 401 if no authorization header is provided', () => {
        mockRequest = { headers: {} };

        requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized: Missing or invalid token format' });
    });

    it('should return 403 if user is not an admin', () => {
        const token = jwt.sign({ sub: 1, role: 'USER' }, JWT_SECRET);
        mockRequest = { headers: { authorization: `Bearer ${token}` } };

        requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Forbidden: Admin access required' });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() if user is an ADMIN', () => {
        const token = jwt.sign({ sub: 1, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
        mockRequest = { headers: { authorization: `Bearer ${token}` } };

        requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect((mockRequest as any).user.role).toBe('ADMIN');
    });

    it('should return 401 if token is expired', () => {
        // Create intrinsically expired token
        const token = jwt.sign({ sub: 1, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 100 }, JWT_SECRET);
        mockRequest = { headers: { authorization: `Bearer ${token}` } };

        requireAdmin(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        // Will be caught by jsonwebtoken itself usually or our custom handling
    });
});
