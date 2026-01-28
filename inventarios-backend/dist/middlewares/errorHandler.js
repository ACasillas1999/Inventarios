"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.notFoundHandler = exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
/**
 * Middleware para manejo centralizado de errores
 */
const errorHandler = (err, req, res, next) => {
    // Log del error
    logger_1.logger.error('Error handler:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    // Determinar código de estado
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    const code = err.code || 'INTERNAL_ERROR';
    // Responder al cliente
    res.status(status).json({
        error: message,
        code,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
/**
 * Middleware para rutas no encontradas
 */
const notFoundHandler = (req, res) => {
    logger_1.logger.warn(`Route not found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND'
    });
};
exports.notFoundHandler = notFoundHandler;
/**
 * Crea un error de API con código de estado
 */
const createError = (message, status = 500, code) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};
exports.createError = createError;
exports.default = exports.errorHandler;
//# sourceMappingURL=errorHandler.js.map