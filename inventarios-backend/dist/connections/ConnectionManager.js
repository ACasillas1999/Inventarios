"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const logger_1 = require("../utils/logger");
/**
 * ConnectionManager - Gestor de conexiones a múltiples bases de datos
 * Mantiene pools de conexiones para cada sucursal y monitorea su estado
 */
class ConnectionManager {
    static instance;
    branchPools = new Map();
    healthCheckInterval = null;
    constructor() { }
    static getInstance() {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }
    /**
     * Inicializa las conexiones a todas las sucursales
     */
    async initializeBranches(branches) {
        logger_1.logger.info(`Initializing ${branches.length} branch connections...`);
        for (const branch of branches) {
            try {
                await this.addBranch(branch);
            }
            catch (error) {
                logger_1.logger.error(`Failed to initialize branch ${branch.code}:`, error);
            }
        }
        // Iniciar monitoreo de salud cada 30 segundos
        this.startHealthCheck();
        logger_1.logger.info('Branch connections initialized');
    }
    /**
     * Agrega una nueva conexión de sucursal o actualiza una existente
     */
    async addBranch(config) {
        // Si ya existe un pool, cerrarlo antes de crear uno nuevo
        if (this.branchPools.has(config.id)) {
            await this.removeBranch(config.id);
        }
        try {
            const poolConfig = {
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                waitForConnections: true,
                connectionLimit: config.poolMax || 5,
                queueLimit: 0,
                enableKeepAlive: true,
                keepAliveInitialDelay: 0,
                charset: 'utf8mb4',
                timezone: 'local'
            };
            const pool = promise_1.default.createPool(poolConfig);
            // Probar la conexión
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();
            this.branchPools.set(config.id, {
                config,
                pool,
                status: 'connected',
                lastCheck: new Date()
            });
            logger_1.logger.info(`Branch ${config.code} (${config.name}) connected successfully`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Crear pool aunque falle para reintentarlo después
            const pool = promise_1.default.createPool({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database,
                waitForConnections: true,
                connectionLimit: config.poolMax || 5,
                queueLimit: 0
            });
            this.branchPools.set(config.id, {
                config,
                pool,
                status: 'error',
                lastCheck: new Date(),
                errorMessage
            });
            logger_1.logger.error(`Branch ${config.code} connection failed: ${errorMessage}`);
        }
    }
    /**
     * Elimina una conexión de sucursal y cierra su pool
     */
    async removeBranch(branchId) {
        const branchPool = this.branchPools.get(branchId);
        if (branchPool) {
            try {
                await branchPool.pool.end();
                logger_1.logger.info(`Closed connection pool for branch ${branchPool.config.code}`);
            }
            catch (error) {
                logger_1.logger.error(`Error closing pool for branch ${branchPool.config.code}:`, error);
            }
            this.branchPools.delete(branchId);
        }
    }
    /**
     * Obtiene el pool de una sucursal por ID
     */
    getPool(branchId) {
        const branchPool = this.branchPools.get(branchId);
        if (!branchPool) {
            logger_1.logger.warn(`Branch pool ${branchId} not found`);
            return null;
        }
        if (branchPool.status === 'error') {
            logger_1.logger.warn(`Branch ${branchPool.config.code} is in error state`);
            return null;
        }
        return branchPool.pool;
    }
    /**
     * Obtiene el pool de una sucursal por código
     */
    getPoolByCode(branchCode) {
        for (const [, branchPool] of this.branchPools) {
            if (branchPool.config.code === branchCode) {
                if (branchPool.status === 'error') {
                    logger_1.logger.warn(`Branch ${branchCode} is in error state`);
                    return null;
                }
                return branchPool.pool;
            }
        }
        logger_1.logger.warn(`Branch pool ${branchCode} not found`);
        return null;
    }
    /**
     * Ejecuta una consulta en una sucursal específica
     */
    async executeQuery(branchId, query, params = []) {
        const pool = this.getPool(branchId);
        if (!pool) {
            throw new Error(`Cannot execute query: branch ${branchId} pool not available`);
        }
        try {
            const safeParams = params === undefined || params === null
                ? []
                : Array.isArray(params)
                    ? params
                    : [params];
            const [rows] = await pool.query(query, safeParams);
            return rows;
        }
        catch (error) {
            logger_1.logger.error(`Query error on branch ${branchId}:`, error);
            throw error;
        }
    }
    /**
     * Ejecuta una consulta en todas las sucursales en paralelo
     */
    async executeQueryOnAllBranches(query, params = []) {
        const results = new Map();
        const promises = [];
        for (const [branchId, branchPool] of this.branchPools) {
            if (branchPool.status === 'connected') {
                promises.push(this.executeQuery(branchId, query, params)
                    .then((rows) => {
                    results.set(branchId, rows);
                })
                    .catch((error) => {
                    logger_1.logger.error(`Query failed on branch ${branchId}:`, error);
                    results.set(branchId, []);
                }));
            }
        }
        await Promise.all(promises);
        return results;
    }
    /**
     * Verifica el estado de salud de una sucursal
     */
    async checkBranchHealth(branchId) {
        const branchPool = this.branchPools.get(branchId);
        if (!branchPool)
            return false;
        try {
            const connection = await branchPool.pool.getConnection();
            await connection.ping();
            connection.release();
            branchPool.status = 'connected';
            branchPool.lastCheck = new Date();
            branchPool.errorMessage = undefined;
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            branchPool.status = 'error';
            branchPool.lastCheck = new Date();
            branchPool.errorMessage = errorMessage;
            logger_1.logger.error(`Health check failed for branch ${branchPool.config.code}: ${errorMessage}`);
            return false;
        }
    }
    /**
     * Verifica el estado de todas las sucursales
     */
    async checkAllBranchesHealth() {
        const healthStatus = new Map();
        const promises = [];
        for (const branchId of this.branchPools.keys()) {
            promises.push(this.checkBranchHealth(branchId).then((isHealthy) => {
                healthStatus.set(branchId, isHealthy);
            }));
        }
        await Promise.all(promises);
        return healthStatus;
    }
    /**
     * Obtiene el estado de todas las sucursales
     */
    getBranchesStatus() {
        const statuses = [];
        for (const [, branchPool] of this.branchPools) {
            statuses.push({
                id: branchPool.config.id,
                code: branchPool.config.code,
                name: branchPool.config.name,
                status: branchPool.status,
                lastCheck: branchPool.lastCheck,
                errorMessage: branchPool.errorMessage
            });
        }
        return statuses;
    }
    /**
     * Inicia el monitoreo periódico de salud
     */
    startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        // Verificar cada 30 segundos
        this.healthCheckInterval = setInterval(async () => {
            logger_1.logger.debug('Running health check on all branches...');
            await this.checkAllBranchesHealth();
        }, 30000);
    }
    /**
     * Detiene el monitoreo de salud
     */
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    /**
     * Cierra todas las conexiones
     */
    async closeAll() {
        this.stopHealthCheck();
        const promises = [];
        for (const [, branchPool] of this.branchPools) {
            promises.push(branchPool.pool.end().catch((error) => {
                logger_1.logger.error(`Error closing pool for ${branchPool.config.code}:`, error);
            }));
        }
        await Promise.all(promises);
        this.branchPools.clear();
        logger_1.logger.info('All branch connections closed');
    }
    /**
     * Obtiene la cantidad de sucursales conectadas
     */
    getConnectedBranchesCount() {
        let count = 0;
        for (const [, branchPool] of this.branchPools) {
            if (branchPool.status === 'connected') {
                count++;
            }
        }
        return count;
    }
    /**
     * Obtiene todas las configuraciones de sucursales
     */
    getAllBranchConfigs() {
        const configs = [];
        for (const [, branchPool] of this.branchPools) {
            configs.push(branchPool.config);
        }
        return configs;
    }
}
exports.ConnectionManager = ConnectionManager;
exports.default = ConnectionManager;
//# sourceMappingURL=ConnectionManager.js.map