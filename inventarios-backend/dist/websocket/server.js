"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToRole = exports.emitToUser = exports.emitToRoom = exports.emitRequestStatus = exports.emitCountProgress = exports.emitStockUpdate = exports.getWebSocketServer = exports.initializeWebSocket = void 0;
const socket_io_1 = require("socket.io");
const auth_1 = require("../middlewares/auth");
const logger_1 = require("../utils/logger");
let io = null;
/**
 * Inicializa el servidor WebSocket
 */
const initializeWebSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        },
        path: process.env.WS_PATH || '/ws'
    });
    // Middleware de autenticación para WebSocket
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        if (!token) {
            logger_1.logger.warn('WebSocket connection attempt without token');
            return next(new Error('Authentication required'));
        }
        const decoded = (0, auth_1.verifyToken)(token.replace('Bearer ', ''));
        if (!decoded) {
            logger_1.logger.warn('WebSocket connection attempt with invalid token');
            return next(new Error('Invalid token'));
        }
        // Agregar usuario al socket
        socket.data.user = decoded;
        next();
    });
    // Manejo de conexiones
    io.on('connection', (socket) => {
        const user = socket.data.user;
        logger_1.logger.info(`WebSocket client connected: ${user.email} (${socket.id})`);
        // Unir al usuario a una sala con su ID
        socket.join(`user:${user.id}`);
        // Unir al usuario a una sala con su rol
        socket.join(`role:${user.role_id}`);
        // Eventos del cliente
        socket.on('join_count', (countId) => {
            socket.join(`count:${countId}`);
            logger_1.logger.debug(`User ${user.id} joined count ${countId}`);
        });
        socket.on('leave_count', (countId) => {
            socket.leave(`count:${countId}`);
            logger_1.logger.debug(`User ${user.id} left count ${countId}`);
        });
        socket.on('join_branch', (branchId) => {
            socket.join(`branch:${branchId}`);
            logger_1.logger.debug(`User ${user.id} joined branch ${branchId}`);
        });
        socket.on('leave_branch', (branchId) => {
            socket.leave(`branch:${branchId}`);
            logger_1.logger.debug(`User ${user.id} left branch ${branchId}`);
        });
        // Desconexión
        socket.on('disconnect', () => {
            logger_1.logger.info(`WebSocket client disconnected: ${user.email} (${socket.id})`);
        });
    });
    logger_1.logger.info('WebSocket server initialized');
    return io;
};
exports.initializeWebSocket = initializeWebSocket;
/**
 * Obtiene la instancia del servidor WebSocket
 */
const getWebSocketServer = () => {
    return io;
};
exports.getWebSocketServer = getWebSocketServer;
/**
 * Emite un evento de actualización de stock
 */
const emitStockUpdate = (branchId, itemCode, oldStock, newStock) => {
    if (!io)
        return;
    io.to(`branch:${branchId}`).emit('stock_updated', {
        type: 'stock_updated',
        data: {
            branch_id: branchId,
            item_code: itemCode,
            old_stock: oldStock,
            new_stock: newStock
        },
        timestamp: new Date()
    });
    logger_1.logger.debug(`Stock update emitted for branch ${branchId}, item ${itemCode}`);
};
exports.emitStockUpdate = emitStockUpdate;
/**
 * Emite un evento de progreso de conteo
 */
const emitCountProgress = (countId, folio, totalItems, countedItems) => {
    if (!io)
        return;
    const percentage = totalItems > 0 ? (countedItems / totalItems) * 100 : 0;
    io.to(`count:${countId}`).emit('count_progress', {
        type: 'count_progress',
        data: {
            count_id: countId,
            folio,
            total_items: totalItems,
            counted_items: countedItems,
            percentage: Number(percentage.toFixed(2))
        },
        timestamp: new Date()
    });
    logger_1.logger.debug(`Count progress emitted for count ${countId}: ${countedItems}/${totalItems}`);
};
exports.emitCountProgress = emitCountProgress;
/**
 * Emite un evento de cambio de estado de solicitud
 */
const emitRequestStatus = (requestId, folio, oldStatus, newStatus) => {
    if (!io)
        return;
    io.emit('request_status', {
        type: 'request_status',
        data: {
            request_id: requestId,
            folio,
            old_status: oldStatus,
            new_status: newStatus
        },
        timestamp: new Date()
    });
    logger_1.logger.debug(`Request status change emitted for request ${requestId}: ${oldStatus} -> ${newStatus}`);
};
exports.emitRequestStatus = emitRequestStatus;
/**
 * Emite un evento personalizado a una sala específica
 */
const emitToRoom = (room, event, data) => {
    if (!io)
        return;
    io.to(room).emit(event, {
        ...data,
        timestamp: new Date()
    });
};
exports.emitToRoom = emitToRoom;
/**
 * Emite un evento a un usuario específico
 */
const emitToUser = (userId, event, data) => {
    (0, exports.emitToRoom)(`user:${userId}`, event, data);
};
exports.emitToUser = emitToUser;
/**
 * Emite un evento a todos los usuarios con un rol específico
 */
const emitToRole = (roleId, event, data) => {
    (0, exports.emitToRoom)(`role:${roleId}`, event, data);
};
exports.emitToRole = emitToRole;
exports.default = {
    initializeWebSocket: exports.initializeWebSocket,
    getWebSocketServer: exports.getWebSocketServer,
    emitStockUpdate: exports.emitStockUpdate,
    emitCountProgress: exports.emitCountProgress,
    emitRequestStatus: exports.emitRequestStatus,
    emitToRoom: exports.emitToRoom,
    emitToUser: exports.emitToUser,
    emitToRole: exports.emitToRole
};
//# sourceMappingURL=server.js.map