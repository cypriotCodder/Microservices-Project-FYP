"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: Missing or invalid token format' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Assert token expiration explicitly
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return res.status(401).json({ message: 'Unauthorized: Token expired' });
        }
        if (decoded.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }
        // Attach user info to request if downstream logic needs it
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token signature' });
    }
};
exports.requireAdmin = requireAdmin;
