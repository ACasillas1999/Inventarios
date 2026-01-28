"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("./logger");
const database_1 = require("../config/database");
/**
 * CacheService - Sistema de caché en memoria para optimizar consultas
 * a bases de datos de sucursales
 */
class CacheService {
    static instance;
    cache;
    constructor() {
        this.cache = new node_cache_1.default({
            stdTTL: database_1.cacheConfig.ttlStock,
            checkperiod: 60,
            useClones: false,
            deleteOnExpire: true
        });
        this.cache.on('expired', (key) => {
            logger_1.logger.debug(`Cache key expired: ${key}`);
        });
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    /**
     * Genera una clave de caché para existencias
     */
    getStockKey(branchId, itemCode) {
        return `stock:${branchId}:${itemCode}`;
    }
    /**
     * Genera una clave de caché para artículos
     */
    getItemKey(itemCode) {
        return `item:${itemCode}`;
    }
    /**
     * Genera una clave de caché para artículos de sucursal
     */
    getBranchItemsKey(branchId, filters) {
        return `branch_items:${branchId}:${filters || 'all'}`;
    }
    /**
     * Obtiene el stock de un artículo desde caché
     */
    getStock(branchId, itemCode) {
        const key = this.getStockKey(branchId, itemCode);
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger_1.logger.debug(`Cache hit: ${key}`);
        }
        return value;
    }
    /**
     * Guarda el stock de un artículo en caché
     */
    setStock(branchId, itemCode, stock, ttl) {
        const key = this.getStockKey(branchId, itemCode);
        const success = this.cache.set(key, stock, ttl || database_1.cacheConfig.ttlStock);
        if (success) {
            logger_1.logger.debug(`Cache set: ${key} = ${stock}`);
        }
    }
    /**
     * Obtiene múltiples stocks desde caché
     */
    getMultipleStocks(branchId, itemCodes) {
        const results = new Map();
        for (const itemCode of itemCodes) {
            results.set(itemCode, this.getStock(branchId, itemCode));
        }
        return results;
    }
    /**
     * Guarda múltiples stocks en caché
     */
    setMultipleStocks(branchId, stocks, ttl) {
        for (const [itemCode, stock] of stocks) {
            this.setStock(branchId, itemCode, stock, ttl);
        }
    }
    /**
     * Obtiene un artículo desde caché
     */
    getItem(itemCode) {
        const key = this.getItemKey(itemCode);
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger_1.logger.debug(`Cache hit: ${key}`);
        }
        return value;
    }
    /**
     * Guarda un artículo en caché
     */
    setItem(itemCode, item, ttl) {
        const key = this.getItemKey(itemCode);
        const success = this.cache.set(key, item, ttl || database_1.cacheConfig.ttlItems);
        if (success) {
            logger_1.logger.debug(`Cache set: ${key}`);
        }
    }
    /**
     * Obtiene artículos de una sucursal desde caché
     */
    getBranchItems(branchId, filters) {
        const key = this.getBranchItemsKey(branchId, filters);
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger_1.logger.debug(`Cache hit: ${key}`);
        }
        return value;
    }
    /**
     * Guarda artículos de una sucursal en caché
     */
    setBranchItems(branchId, items, filters, ttl) {
        const key = this.getBranchItemsKey(branchId, filters);
        const success = this.cache.set(key, items, ttl || database_1.cacheConfig.ttlItems);
        if (success) {
            logger_1.logger.debug(`Cache set: ${key} (${items.length} items)`);
        }
    }
    /**
     * Invalida el caché de stock de un artículo específico
     */
    invalidateStock(branchId, itemCode) {
        const key = this.getStockKey(branchId, itemCode);
        this.cache.del(key);
        logger_1.logger.debug(`Cache invalidated: ${key}`);
    }
    /**
     * Invalida todo el caché de stock de una sucursal
     */
    invalidateBranchStock(branchId) {
        const pattern = `stock:${branchId}:`;
        const keys = this.cache.keys().filter((key) => key.startsWith(pattern));
        this.cache.del(keys);
        logger_1.logger.debug(`Cache invalidated: ${keys.length} keys for branch ${branchId}`);
    }
    /**
     * Invalida el caché de artículos de una sucursal
     */
    invalidateBranchItems(branchId) {
        const pattern = `branch_items:${branchId}:`;
        const keys = this.cache.keys().filter((key) => key.startsWith(pattern));
        this.cache.del(keys);
        logger_1.logger.debug(`Cache invalidated: ${keys.length} keys for branch ${branchId} items`);
    }
    /**
     * Invalida todo el caché de una sucursal
     */
    invalidateBranch(branchId) {
        this.invalidateBranchStock(branchId);
        this.invalidateBranchItems(branchId);
    }
    /**
     * Obtiene estadísticas del caché
     */
    getStats() {
        return this.cache.getStats();
    }
    /**
     * Limpia todo el caché
     */
    flushAll() {
        this.cache.flushAll();
        logger_1.logger.info('Cache flushed');
    }
    /**
     * Obtiene una clave genérica del caché
     */
    get(key) {
        return this.cache.get(key);
    }
    /**
     * Guarda una clave genérica en el caché
     */
    set(key, value, ttl) {
        return this.cache.set(key, value, ttl || database_1.cacheConfig.ttlConfig);
    }
    /**
     * Elimina una clave del caché
     */
    delete(key) {
        return this.cache.del(key);
    }
    /**
     * Verifica si una clave existe en caché
     */
    has(key) {
        return this.cache.has(key);
    }
}
exports.CacheService = CacheService;
exports.default = CacheService;
//# sourceMappingURL=cache.js.map