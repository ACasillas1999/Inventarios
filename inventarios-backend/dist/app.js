"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Configuración
dotenv_1.default.config();
// Importar utilidades
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middlewares/errorHandler");
// Importar gestores
const ConnectionManager_1 = require("./connections/ConnectionManager");
const database_1 = require("./config/database");
const server_1 = require("./websocket/server");
// Importar rutas
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const stock_routes_1 = __importDefault(require("./routes/stock.routes"));
const counts_routes_1 = __importDefault(require("./routes/counts.routes"));
const branches_routes_1 = __importDefault(require("./routes/branches.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const requests_routes_1 = __importDefault(require("./routes/requests.routes"));
// Constantes
const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
/**
 * Inicializa la aplicación Express
 */
const createApp = () => {
    const app = (0, express_1.default)();
    // Middlewares de seguridad y utilidad
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)({
        origin: CORS_ORIGIN,
        credentials: true
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Logger de requests en desarrollo
    if (NODE_ENV === 'development') {
        app.use((req, res, next) => {
            logger_1.logger.debug(`${req.method} ${req.url}`);
            next();
        });
    }
    // Health check
    app.get('/health', (req, res) => {
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const connectedBranches = connectionManager.getConnectedBranchesCount();
        const totalBranches = connectionManager.getAllBranchConfigs().length;
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: NODE_ENV,
            database: {
                local: 'connected',
                branches: {
                    connected: connectedBranches,
                    total: totalBranches
                }
            }
        });
    });
    // Rutas de la API
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/stock', stock_routes_1.default);
    app.use('/api/counts', counts_routes_1.default);
    app.use('/api/branches', branches_routes_1.default);
    app.use('/api/users', users_routes_1.default);
    app.use('/api/requests', requests_routes_1.default);
    // Ruta raíz
    app.get('/', (req, res) => {
        res.json({
            name: 'Inventarios Backend API',
            version: '1.0.0',
            status: 'running',
            documentation: '/api/docs'
        });
    });
    // Manejadores de errores
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
/**
 * Inicializa las conexiones a las bases de datos
 */
const initializeDatabases = async () => {
    logger_1.logger.info('Initializing database connections...');
    try {
        // Verificar conexión a base de datos local
        const localPool = (0, database_1.getLocalPool)();
        await localPool.query('SELECT 1');
        logger_1.logger.info('Local database connected successfully');
        // Inicializar conexiones a sucursales
        const branchDatabases = await (0, database_1.getBranchDatabases)();
        if (branchDatabases.length === 0) {
            logger_1.logger.warn('No branch databases configured');
        }
        else {
            const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
            await connectionManager.initializeBranches(branchDatabases);
            logger_1.logger.info(`${connectionManager.getConnectedBranchesCount()} of ${branchDatabases.length} branch databases connected`);
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize databases:', error);
        throw error;
    }
};
/**
 * Crea el directorio de logs si no existe
 */
const ensureLogsDirectory = () => {
    const logsDir = path_1.default.join(process.cwd(), 'logs');
    if (!fs_1.default.existsSync(logsDir)) {
        fs_1.default.mkdirSync(logsDir, { recursive: true });
        logger_1.logger.info('Logs directory created');
    }
};
/**
 * Inicia el servidor
 */
const startServer = async () => {
    try {
        // Asegurar que existe el directorio de logs
        ensureLogsDirectory();
        logger_1.logger.info('Starting Inventarios Backend...');
        logger_1.logger.info(`Environment: ${NODE_ENV}`);
        logger_1.logger.info(`Port: ${PORT}`);
        // Inicializar bases de datos
        await initializeDatabases();
        // Crear aplicación Express
        const app = createApp();
        // Crear servidor HTTP
        const httpServer = (0, http_1.createServer)(app);
        // Inicializar WebSocket si está habilitado
        const wsEnabled = process.env.WS_ENABLED !== 'false';
        if (wsEnabled) {
            (0, server_1.initializeWebSocket)(httpServer);
            logger_1.logger.info('WebSocket server enabled');
        }
        else {
            logger_1.logger.info('WebSocket server disabled');
        }
        // Iniciar servidor
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`🚀 Server running on http://localhost:${PORT}`);
            logger_1.logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            if (wsEnabled) {
                logger_1.logger.info(`🔌 WebSocket: ws://localhost:${PORT}${process.env.WS_PATH || '/ws'}`);
            }
        });
        // Manejo de cierre graceful
        const shutdown = async (signal) => {
            logger_1.logger.info(`${signal} received, shutting down gracefully...`);
            httpServer.close(async () => {
                logger_1.logger.info('HTTP server closed');
                try {
                    // Cerrar conexiones a bases de datos
                    const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
                    await connectionManager.closeAll();
                    logger_1.logger.info('All database connections closed');
                    process.exit(0);
                }
                catch (error) {
                    logger_1.logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
            // Forzar salida después de 10 segundos
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Manejo de errores no capturados
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught exception:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error('Unhandled rejection:', reason);
            process.exit(1);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Iniciar servidor
startServer();
//# sourceMappingURL=app.js.map