"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const ConnectionManager_1 = require("../connections/ConnectionManager");
const cache_1 = require("../utils/cache");
const logger_1 = require("../utils/logger");
/**
 * StockService - Servicio para consultar existencias en las sucursales
 * Utiliza caché para optimizar las consultas repetidas
 */
class StockService {
    connectionManager;
    cacheService;
    constructor() {
        this.connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        this.cacheService = cache_1.CacheService.getInstance();
    }
    /**
     * Obtiene la existencia de un artículo en una sucursal
     * Intenta primero desde caché, luego consulta la BD
     */
    async getStock(branchId, itemCode) {
        // Intentar obtener desde caché
        const cachedStock = this.cacheService.getStock(branchId, itemCode);
        if (cachedStock !== undefined) {
            return cachedStock;
        }
        // Consultar base de datos
        const stock = await this.queryStockFromDatabase(branchId, itemCode);
        // Guardar en caché
        this.cacheService.setStock(branchId, itemCode, stock);
        return stock;
    }
    /**
     * Consulta la existencia directamente de la base de datos
     * Adaptado al esquema real: Tabla articuloalm con columnas Clave_Articulo y Existencia_Fisica
     */
    async queryStockFromDatabase(branchId, itemCode) {
        try {
            // Consulta adaptada al esquema real de la base de datos
            const query = `
        SELECT Existencia_Fisica as stock
        FROM articuloalm
        WHERE Clave_Articulo = ?
        LIMIT 1
      `;
            const results = await this.connectionManager.executeQuery(branchId, query, [itemCode]);
            if (results.length === 0) {
                logger_1.logger.warn(`Item ${itemCode} not found in branch ${branchId}`);
                return 0;
            }
            return results[0].stock || 0;
        }
        catch (error) {
            // Si la tabla no existe, retornar 0
            if (error.code === 'ER_NO_SUCH_TABLE') {
                logger_1.logger.warn(`Table articuloalm does not exist in branch ${branchId}`);
                return 0;
            }
            // Si la sucursal no está disponible o hay error de conexión
            if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                logger_1.logger.warn(`Branch ${branchId} is not available`);
                return 0;
            }
            logger_1.logger.error(`Error querying stock for ${itemCode} in branch ${branchId}:`, error);
            throw error;
        }
    }
    /**
     * Obtiene las existencias de múltiples artículos en una sucursal
     * Optimizado para consultas en paralelo
     */
    async getBatchStock(branchId, itemCodes) {
        const stocks = new Map();
        // Separar artículos en caché y no en caché
        const cachedStocks = this.cacheService.getMultipleStocks(branchId, itemCodes);
        const itemsToQuery = [];
        for (const [itemCode, stock] of cachedStocks) {
            if (stock !== undefined) {
                stocks.set(itemCode, stock);
            }
            else {
                itemsToQuery.push(itemCode);
            }
        }
        // Si todos están en caché, retornar
        if (itemsToQuery.length === 0) {
            return stocks;
        }
        // Consultar los que no están en caché
        try {
            // Consulta adaptada al esquema real
            const placeholders = itemsToQuery.map(() => '?').join(',');
            const query = `
        SELECT Clave_Articulo as item_code, Existencia_Fisica as stock
        FROM articuloalm
        WHERE Clave_Articulo IN (${placeholders})
      `;
            const results = await this.connectionManager.executeQuery(branchId, query, itemsToQuery);
            // Procesar resultados y guardar en caché
            const queriedStocks = new Map();
            for (const row of results) {
                const stock = row.stock || 0;
                stocks.set(row.item_code, stock);
                queriedStocks.set(row.item_code, stock);
            }
            // Guardar en caché
            this.cacheService.setMultipleStocks(branchId, queriedStocks);
            // Agregar 0 para artículos no encontrados
            for (const itemCode of itemsToQuery) {
                if (!stocks.has(itemCode)) {
                    stocks.set(itemCode, 0);
                    this.cacheService.setStock(branchId, itemCode, 0);
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Error querying batch stock in branch ${branchId}:`, error);
            throw error;
        }
        return stocks;
    }
    /**
     * Obtiene las existencias de un artículo en todas las sucursales
     * Ejecuta consultas en paralelo
     */
    async getStockAllBranches(itemCode) {
        const branches = this.connectionManager.getAllBranchConfigs();
        const results = [];
        const promises = branches.map(async (branch) => {
            try {
                const stock = await this.getStock(branch.id, itemCode);
                return {
                    branch_id: branch.id,
                    branch_code: branch.code,
                    item_code: itemCode,
                    stock,
                    cached: this.cacheService.getStock(branch.id, itemCode) !== undefined
                };
            }
            catch (error) {
                logger_1.logger.error(`Error getting stock for ${itemCode} in branch ${branch.code}:`, error);
                return {
                    branch_id: branch.id,
                    branch_code: branch.code,
                    item_code: itemCode,
                    stock: 0,
                    cached: false
                };
            }
        });
        const resolved = await Promise.all(promises);
        results.push(...resolved);
        return results;
    }
    /**
     * Obtiene información completa de un artículo de una sucursal
     */
    async getItemInfo(branchId, itemCode) {
        try {
            // Intentar desde caché
            const cachedItem = this.cacheService.getItem(itemCode);
            if (cachedItem) {
                return cachedItem;
            }
            // Consulta adaptada al esquema real (catálogo en articulo + existencia en articuloalm)
            const query = `
        SELECT
          a.Clave_Articulo as codigo,
          a.Descripcion as descripcion,
          a.Linea as linea,
          a.Unidad_Medida as unidad,
          alm.Almacen as almacen,
          IFNULL(alm.Existencia_Fisica, 0) as existencia,
          IFNULL(alm.Existencia_Fisica, 0) as existencia_fisica,
          alm.Rack as rack,
          COALESCE(alm.Inventario_Minimo, a.Inventario_Minimo) as Inventario_Minimo,
          COALESCE(alm.Inventario_Maximo, a.Inventario_Maximo) as Inventario_Maximo,
          COALESCE(alm.Punto_Reorden, a.Punto_Reorden) as Punto_Reorden,
          COALESCE(alm.Existencia_Teorica, a.Existencia_Teorica, 0) as Existencia_Teorica,
          COALESCE(alm.Inventario_Minimo, a.Inventario_Minimo) as inventario_minimo,
          COALESCE(alm.Inventario_Maximo, a.Inventario_Maximo) as inventario_maximo,
          COALESCE(alm.Punto_Reorden, a.Punto_Reorden) as punto_reorden,
          COALESCE(alm.Existencia_Teorica, a.Existencia_Teorica, 0) as existencia_teorica,
          COALESCE(alm.Costo_Promedio, a.Costo_Promedio) as Costo_Promedio,
          COALESCE(alm.Costo_Promedio_Ant, a.Costo_Promedio_Ant) as Costo_Promedio_Ant,
          COALESCE(alm.Costo_Ult_Compra, a.Costo_Ult_Compra) as Costo_Ult_Compra,
          COALESCE(alm.Fecha_Ult_Compra, a.Fecha_Ult_Compra) as Fecha_Ult_Compra,
          COALESCE(alm.Costo_Compra_Ant, a.Costo_Compra_Ant) as Costo_Compra_Ant,
          COALESCE(alm.Fecha_Compra_Ant, a.Fecha_Compra_Ant) as Fecha_Compra_Ant,
          COALESCE(alm.Costo_Promedio, a.Costo_Promedio) as costo_promedio,
          COALESCE(alm.Costo_Promedio_Ant, a.Costo_Promedio_Ant) as costo_promedio_ant,
          COALESCE(alm.Costo_Ult_Compra, a.Costo_Ult_Compra) as costo_ultima_compra,
          COALESCE(alm.Fecha_Ult_Compra, a.Fecha_Ult_Compra) as fecha_ult_compra,
          COALESCE(alm.Costo_Compra_Ant, a.Costo_Compra_Ant) as costo_compra_ant,
          COALESCE(alm.Fecha_Compra_Ant, a.Fecha_Compra_Ant) as fecha_compra_ant,
          COALESCE(alm.PendientedeEntrega, 0) as pendiente_entrega
        FROM articulo a
        LEFT JOIN articuloalm alm ON alm.Clave_Articulo = a.Clave_Articulo
        WHERE a.Clave_Articulo = ?
        LIMIT 1
      `;
            const results = await this.connectionManager.executeQuery(branchId, query, [itemCode]);
            if (results.length === 0) {
                return null;
            }
            const item = results[0];
            // Guardar en caché
            this.cacheService.setItem(itemCode, item);
            return item;
        }
        catch (error) {
            // Si las tablas no existen, retornar null
            if (error.code === 'ER_NO_SUCH_TABLE') {
                logger_1.logger.warn(`Table articulo/articuloalm does not exist in branch ${branchId}`);
                return null;
            }
            // Si la sucursal no está disponible o hay error de conexión
            if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                logger_1.logger.warn(`Branch ${branchId} is not available`);
                return null;
            }
            logger_1.logger.error(`Error getting item info for ${itemCode} in branch ${branchId}:`, error);
            throw error;
        }
    }
    /**
     * Busca artículos en una sucursal con filtros
     */
    async searchItems(branchId, search, linea, limit = 50, offset = 0) {
        try {
            // Generar clave de caché
            const cacheKey = `v2_${search || 'all'}_${linea || 'all'}_${limit}_${offset}`;
            const cachedItems = this.cacheService.getBranchItems(branchId, cacheKey);
            if (cachedItems) {
                return cachedItems;
            }
            // Estrategia optimizada sin JOIN: primero obtener artículos, luego buscar existencias
            // Esto es mucho más rápido cuando articuloalm no tiene índice en Clave_Articulo
            let query = `
        SELECT
          Clave_Articulo as codigo,
          Descripcion as descripcion,
          Linea as linea,
          Unidad_Medida as unidad,
          Inventario_Minimo as inventario_minimo,
          Inventario_Maximo as inventario_maximo,
          Existencia_Teorica as existencia_teorica,
          Punto_Reorden as punto_reorden,
          Costo_Promedio as costo_promedio,
          Costo_Ult_Compra as costo_ultima_compra,
          Fecha_Ult_Compra as fecha_ult_compra
        FROM articulo
        WHERE 1=1
      `;
            const params = [];
            if (search) {
                query += ` AND (Clave_Articulo LIKE ? OR Descripcion LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }
            if (linea === '__EMPTY__') {
                query += ` AND (Linea IS NULL OR Linea = '')`;
            }
            else if (linea) {
                query += ` AND Linea = ?`;
                params.push(linea);
            }
            query += ` ORDER BY Clave_Articulo LIMIT ${parseInt(String(limit))} OFFSET ${parseInt(String(offset))}`;
            const articles = await this.connectionManager.executeQuery(branchId, query, params);
            const itemCodes = articles.map((a) => a.codigo).filter(Boolean);
            const stockByCode = new Map();
            if (itemCodes.length > 0) {
                try {
                    const placeholders = itemCodes.map(() => '?').join(',');
                    const stockQuery = `
            SELECT
              Clave_Articulo as codigo,
              MIN(Almacen) as almacen,
              SUM(Existencia_Fisica) as existencia_fisica,
              SUM(Existencia_Teorica) as existencia_teorica,
              MAX(Inventario_Minimo) as inventario_minimo,
              MAX(Inventario_Maximo) as inventario_maximo,
              MAX(Punto_Reorden) as punto_reorden,
              MAX(Rack) as rack,
              MAX(Costo_Promedio) as costo_promedio,
              MAX(Costo_Promedio_Ant) as costo_promedio_ant,
              MAX(Costo_Ult_Compra) as costo_ultima_compra,
              MAX(Fecha_Ult_Compra) as fecha_ult_compra,
              MAX(Costo_Compra_Ant) as costo_compra_ant,
              MAX(Fecha_Compra_Ant) as fecha_compra_ant,
              MAX(PendientedeEntrega) as pendiente_entrega
            FROM articuloalm
            WHERE Clave_Articulo IN (${placeholders})
            GROUP BY Clave_Articulo
          `;
                    const stockRows = await this.connectionManager.executeQuery(branchId, stockQuery, itemCodes);
                    for (const row of stockRows) {
                        stockByCode.set(row.codigo, row);
                    }
                }
                catch (error) {
                    if (error.code === 'ER_NO_SUCH_TABLE') {
                        logger_1.logger.warn(`Table articuloalm does not exist in branch ${branchId}`);
                    }
                    else if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                        logger_1.logger.warn(`Branch ${branchId} is not available`);
                    }
                    else {
                        logger_1.logger.warn(`Could not load stock from articuloalm for branch ${branchId}: ${error.message || error}`);
                    }
                }
            }
            const results = articles.map((article) => {
                const stock = stockByCode.get(article.codigo);
                const existenciaFisica = Number(stock?.existencia_fisica ?? 0) || 0;
                const existenciaTeorica = Number(stock?.existencia_teorica ?? article.existencia_teorica ?? 0) || 0;
                return {
                    codigo: article.codigo,
                    descripcion: article.descripcion,
                    linea: article.linea,
                    unidad: article.unidad,
                    almacen: stock?.almacen,
                    existencia: existenciaFisica,
                    existencia_fisica: existenciaFisica,
                    existencia_teorica: existenciaTeorica,
                    Existencia_Teorica: existenciaTeorica,
                    rack: stock?.rack,
                    Rack: stock?.rack,
                    inventario_minimo: stock?.inventario_minimo ?? article.inventario_minimo,
                    inventario_maximo: stock?.inventario_maximo ?? article.inventario_maximo,
                    Inventario_Minimo: stock?.inventario_minimo ?? article.inventario_minimo,
                    Inventario_Maximo: stock?.inventario_maximo ?? article.inventario_maximo,
                    punto_reorden: stock?.punto_reorden ?? article.punto_reorden,
                    Punto_Reorden: stock?.punto_reorden ?? article.punto_reorden,
                    costo_promedio: stock?.costo_promedio ?? article.costo_promedio,
                    costo_promedio_ant: stock?.costo_promedio_ant,
                    costo_ultima_compra: stock?.costo_ultima_compra ?? article.costo_ultima_compra,
                    fecha_ult_compra: stock?.fecha_ult_compra ?? article.fecha_ult_compra,
                    costo_compra_ant: stock?.costo_compra_ant,
                    fecha_compra_ant: stock?.fecha_compra_ant,
                    pendiente_entrega: Number(stock?.pendiente_entrega ?? 0) || 0
                };
            });
            // Guardar en caché
            this.cacheService.setBranchItems(branchId, results, cacheKey);
            return results;
        }
        catch (error) {
            // Si las tablas no existen, retornar array vacío en lugar de error
            if (error.code === 'ER_NO_SUCH_TABLE') {
                logger_1.logger.warn(`Table articulo/articuloalm does not exist in branch ${branchId}`);
                return [];
            }
            // Si la sucursal no está disponible o hay error de conexión
            if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                logger_1.logger.warn(`Branch ${branchId} is not available`);
                return [];
            }
            logger_1.logger.error(`Error searching items in branch ${branchId}:`, error);
            throw error;
        }
    }
    /**
     * Invalida el caché de un artículo en una sucursal
     */
    invalidateCache(branchId, itemCode) {
        if (itemCode) {
            this.cacheService.invalidateStock(branchId, itemCode);
        }
        else {
            this.cacheService.invalidateBranch(branchId);
        }
    }
    /**
     * Sincroniza las existencias de múltiples artículos
     * Útil para actualizar el caché
     */
    async syncStocks(branchId, itemCodes) {
        logger_1.logger.info(`Syncing ${itemCodes.length} items for branch ${branchId}`);
        // Invalidar caché existente
        for (const itemCode of itemCodes) {
            this.cacheService.invalidateStock(branchId, itemCode);
        }
        // Recargar desde base de datos
        await this.getBatchStock(branchId, itemCodes);
        logger_1.logger.info(`Sync completed for branch ${branchId}`);
    }
    /**
     * Obtiene las líneas (familias) distintas del catálogo de una sucursal
     */
    async getLines(branchId) {
        try {
            // Intentar obtener desde caché
            const cacheKey = 'all_lines';
            const cachedLines = this.cacheService.getBranchItems(branchId, cacheKey);
            if (cachedLines) {
                return cachedLines;
            }
            // Query optimizada con LIMIT para evitar escaneo completo de tabla grande
            const query = `
        SELECT DISTINCT Linea as linea
        FROM articulo
        WHERE Linea IS NOT NULL AND Linea <> ''
        ORDER BY linea ASC
        LIMIT 1000
      `;
            const results = await this.connectionManager.executeQuery(branchId, query, []);
            const lines = results.map((row) => row.linea);
            // Guardar en caché por 1 hora (las líneas no cambian frecuentemente)
            this.cacheService.setBranchItems(branchId, lines, cacheKey);
            return lines;
        }
        catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                logger_1.logger.warn(`Table articulo does not exist in branch ${branchId}`);
                return [];
            }
            // Si la sucursal no está disponible o hay error de conexión
            if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                logger_1.logger.warn(`Branch ${branchId} is not available`);
                return [];
            }
            logger_1.logger.error(`Error getting lines in branch ${branchId}:`, error);
            throw error;
        }
    }
    /**
     * Obtiene los códigos de artículos para una sucursal (opcionalmente filtrado por línea)
     * Útil para "seleccionar todos" sin paginación.
     */
    async getItemCodes(branchId, linea) {
        try {
            let query = `
        SELECT Clave_Articulo as codigo
        FROM articulo
        WHERE 1=1
      `;
            const params = [];
            if (linea === '__EMPTY__') {
                query += ` AND (Linea IS NULL OR Linea = '')`;
            }
            else if (linea) {
                query += ` AND Linea = ?`;
                params.push(linea);
            }
            query += ` ORDER BY Clave_Articulo ASC`;
            const results = await this.connectionManager.executeQuery(branchId, query, params);
            return results.map((r) => r.codigo).filter(Boolean);
        }
        catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                logger_1.logger.warn(`Table articulo does not exist in branch ${branchId}`);
                return [];
            }
            if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
                logger_1.logger.warn(`Branch ${branchId} is not available`);
                return [];
            }
            logger_1.logger.error(`Error getting item codes in branch ${branchId}:`, error);
            throw error;
        }
    }
}
exports.StockService = StockService;
exports.default = StockService;
//# sourceMappingURL=StockService.js.map