"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItemCodes = exports.getLines = exports.invalidateCache = exports.searchItems = exports.getItemInfo = exports.compareStock = exports.getStockAllBranches = exports.getBatchStock = exports.getStock = void 0;
const StockService_1 = __importDefault(require("../services/StockService"));
const logger_1 = require("../utils/logger");
const stockService = new StockService_1.default();
/**
 * Obtiene la existencia de un artículo en una sucursal
 * GET /api/stock/:branchId/:itemCode
 */
const getStock = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const itemCode = req.params.itemCode;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const stock = await stockService.getStock(branchId, itemCode);
        res.json({
            branch_id: branchId,
            item_code: itemCode,
            stock
        });
    }
    catch (error) {
        logger_1.logger.error('Get stock error:', error);
        res.status(500).json({ error: 'Failed to get stock' });
    }
};
exports.getStock = getStock;
/**
 * Obtiene las existencias de múltiples artículos en una sucursal
 * POST /api/stock/:branchId/batch
 * Body: { itemCodes: string[] }
 */
const getBatchStock = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const { itemCodes } = req.body;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        if (!Array.isArray(itemCodes) || itemCodes.length === 0) {
            res.status(400).json({ error: 'itemCodes must be a non-empty array' });
            return;
        }
        const stocks = await stockService.getBatchStock(branchId, itemCodes);
        const results = Array.from(stocks.entries()).map(([itemCode, stock]) => ({
            item_code: itemCode,
            stock
        }));
        res.json({
            branch_id: branchId,
            stocks: results
        });
    }
    catch (error) {
        logger_1.logger.error('Get batch stock error:', error);
        res.status(500).json({ error: 'Failed to get batch stock' });
    }
};
exports.getBatchStock = getBatchStock;
/**
 * Obtiene las existencias de un artículo en todas las sucursales
 * GET /api/stock/all/:itemCode
 */
const getStockAllBranches = async (req, res) => {
    try {
        const itemCode = req.params.itemCode;
        const stocks = await stockService.getStockAllBranches(itemCode);
        res.json({
            item_code: itemCode,
            branches: stocks
        });
    }
    catch (error) {
        logger_1.logger.error('Get stock all branches error:', error);
        res.status(500).json({ error: 'Failed to get stock from all branches' });
    }
};
exports.getStockAllBranches = getStockAllBranches;
/**
 * Compara stock del sistema vs stock contado
 * POST /api/stock/compare
 * Body: StockCompareRequest
 */
const compareStock = async (req, res) => {
    try {
        const { branch_id, items } = req.body;
        if (!branch_id || !items || !Array.isArray(items)) {
            res.status(400).json({ error: 'Invalid request body' });
            return;
        }
        // Obtener tolerancia del sistema (podrías obtenerla de settings)
        const tolerancePercentage = 5.0;
        const itemCodes = items.map((item) => item.item_code);
        const systemStocks = await stockService.getBatchStock(branch_id, itemCodes);
        const results = items.map((item) => {
            const systemStock = systemStocks.get(item.item_code) || 0;
            const countedStock = item.counted_stock;
            const difference = countedStock - systemStock;
            let differencePercentage = 0;
            if (systemStock !== 0) {
                differencePercentage = (difference / systemStock) * 100;
            }
            else if (countedStock !== 0) {
                differencePercentage = 100;
            }
            const exceedsTolerance = Math.abs(differencePercentage) > tolerancePercentage;
            return {
                item_code: item.item_code,
                system_stock: systemStock,
                counted_stock: countedStock,
                difference,
                difference_percentage: Number(differencePercentage.toFixed(2)),
                exceeds_tolerance: exceedsTolerance
            };
        });
        res.json({
            branch_id,
            tolerance_percentage: tolerancePercentage,
            comparisons: results,
            summary: {
                total_items: results.length,
                items_with_difference: results.filter((r) => r.difference !== 0).length,
                items_exceeding_tolerance: results.filter((r) => r.exceeds_tolerance).length
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Compare stock error:', error);
        res.status(500).json({ error: 'Failed to compare stock' });
    }
};
exports.compareStock = compareStock;
/**
 * Obtiene información completa de un artículo
 * GET /api/stock/:branchId/item/:itemCode
 */
const getItemInfo = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const itemCode = req.params.itemCode;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const item = await stockService.getItemInfo(branchId, itemCode);
        if (!item) {
            res.status(404).json({ error: 'Item not found' });
            return;
        }
        res.json(item);
    }
    catch (error) {
        logger_1.logger.error('Get item info error:', error);
        res.status(500).json({ error: 'Failed to get item info' });
    }
};
exports.getItemInfo = getItemInfo;
/**
 * Busca artículos en una sucursal
 * GET /api/stock/:branchId/items?search=xxx&linea=yyy&limit=50&offset=0
 */
const searchItems = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const search = req.query.search;
        const linea = req.query.linea;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const items = await stockService.searchItems(branchId, search, linea, limit, offset);
        res.json({
            branch_id: branchId,
            items,
            pagination: {
                limit,
                offset,
                count: items.length
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Search items error:', error);
        res.status(500).json({ error: 'Failed to search items' });
    }
};
exports.searchItems = searchItems;
/**
 * Invalida el caché de un artículo o sucursal
 * DELETE /api/stock/cache/:branchId/:itemCode?
 */
const invalidateCache = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const itemCode = req.params.itemCode;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        stockService.invalidateCache(branchId, itemCode);
        res.json({
            message: itemCode
                ? `Cache invalidated for branch ${branchId}, item ${itemCode}`
                : `All cache invalidated for branch ${branchId}`
        });
    }
    catch (error) {
        logger_1.logger.error('Invalidate cache error:', error);
        res.status(500).json({ error: 'Failed to invalidate cache' });
    }
};
exports.invalidateCache = invalidateCache;
/**
 * Obtiene las líneas/familias disponibles en el catálogo de una sucursal
 * GET /api/stock/:branchId/lines
 */
const getLines = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const lines = await stockService.getLines(branchId);
        res.json({ branch_id: branchId, lines });
    }
    catch (error) {
        logger_1.logger.error('Get lines error:', error);
        res.status(500).json({ error: 'Failed to get lines' });
    }
};
exports.getLines = getLines;
/**
 * Obtiene los códigos de artículos de una sucursal (opcionalmente filtrado por línea)
 * GET /api/stock/:branchId/item-codes?linea=xxx
 */
const getItemCodes = async (req, res) => {
    try {
        const branchId = parseInt(req.params.branchId);
        const linea = req.query.linea;
        if (isNaN(branchId)) {
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const itemCodes = await stockService.getItemCodes(branchId, linea);
        res.json({ branch_id: branchId, item_codes: itemCodes });
    }
    catch (error) {
        logger_1.logger.error('Get item codes error:', error);
        res.status(500).json({ error: 'Failed to get item codes' });
    }
};
exports.getItemCodes = getItemCodes;
exports.default = {
    getStock: exports.getStock,
    getBatchStock: exports.getBatchStock,
    getStockAllBranches: exports.getStockAllBranches,
    compareStock: exports.compareStock,
    getItemInfo: exports.getItemInfo,
    searchItems: exports.searchItems,
    invalidateCache: exports.invalidateCache,
    getLines: exports.getLines,
    getItemCodes: exports.getItemCodes
};
//# sourceMappingURL=stockController.js.map