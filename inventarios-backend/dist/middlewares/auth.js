"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = exports.requireRole = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
/**
 * Middleware para verificar el token JWT
 */
const authMiddleware = (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'No authorization header provided' });
            return;
        }
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;
        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        // Verificar token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Agregar usuario a la request
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.logger.warn('Invalid JWT token:', error.message);
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        else if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            logger_1.logger.warn('JWT token expired');
            res.status(401).json({ error: 'Token expired' });
            return;
        }
        logger_1.logger.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Middleware para verificar roles específicos
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role_id)) {
            logger_1.logger.warn(`User ${req.user.id} attempted to access restricted resource`);
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
/**
 * Genera un token JWT
 */
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        role_id: user.role_id
    }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
};
exports.generateToken = generateToken;
/**
 * Verifica un token sin lanzar error
 */
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
};
exports.verifyToken = verifyToken;
exports.default = exports.authMiddleware;
//# sourceMappingURL=auth.js.map