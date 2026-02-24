"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCount = exports.listDifferences = exports.getDashboardStats = exports.updateCountDetail = exports.addCountDetail = exports.getCountDetails = exports.createRequestsFromCount = exports.updateCount = exports.listCounts = exports.getCountByFolio = exports.getCount = exports.getItemsHistory = exports.createCount = void 0;
const CountsService_1 = __importDefault(require("../services/CountsService"));
const logger_1 = require("../utils/logger");
const countsService = new CountsService_1.default();
/**
 * Crea un nuevo conteo
 * POST /api/counts
 */
const createCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const data = req.body;
        if (!data.branch_id || !data.type || !data.responsible_user_id) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const counts = await countsService.createCount(userId, data);
        res.status(201).json({
            counts,
            total_created: counts.length,
            folios: counts.map(c => c.folio)
        });
    }
    catch (error) {
        logger_1.logger.error('Create count error:', error);
        const message = error instanceof Error ? error.message : 'Failed to create count';
        if (typeof message === 'string' && (message.startsWith('Too many items') || message.includes('No items found'))) {
            res.status(400).json({ error: message });
            return;
        }
        res.status(500).json({ error: message });
    }
};
exports.createCount = createCount;
/**
 * Historial de artículos contados en un rango (por sucursal)
 * POST /api/counts/history/items
 */
const getItemsHistory = async (req, res) => {
    try {
        const branchId = Number(req.body?.branch_id);
        const itemCodes = Array.isArray(req.body?.item_codes) ? req.body.item_codes : [];
        const from = req.body?.from ? String(req.body.from) : '';
        const to = req.body?.to ? String(req.body.to) : '';
        const almacen = req.body?.almacen ? Number(req.body.almacen) : undefined;
        if (!Number.isFinite(branchId) || branchId <= 0) {
            res.status(400).json({ error: 'Invalid branch_id' });
            return;
        }
        if (!from || !to) {
            res.status(400).json({ error: 'from/to are required' });
            return;
        }
        if (itemCodes.length === 0) {
            res.json({ branch_id: branchId, from, to, almacen, items: [] });
            return;
        }
        const items = await countsService.getItemsHistory(branchId, itemCodes, from, to, almacen);
        res.json({ branch_id: branchId, from, to, almacen, items });
    }
    catch (error) {
        logger_1.logger.error('Get items history error:', error);
        res.status(500).json({ error: 'Failed to get items history' });
    }
};
exports.getItemsHistory = getItemsHistory;
/**
 * Obtiene un conteo por ID
 * GET /api/counts/:id
 */
const getCount = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        const count = await countsService.getCountById(id);
        if (!count) {
            res.status(404).json({ error: 'Count not found' });
            return;
        }
        res.json(count);
    }
    catch (error) {
        logger_1.logger.error('Get count error:', error);
        res.status(500).json({ error: 'Failed to get count' });
    }
};
exports.getCount = getCount;
/**
 * Obtiene un conteo por folio
 * GET /api/counts/folio/:folio
 */
const getCountByFolio = async (req, res) => {
    try {
        const folio = req.params.folio;
        const count = await countsService.getCountByFolio(folio);
        if (!count) {
            res.status(404).json({ error: 'Count not found' });
            return;
        }
        res.json(count);
    }
    catch (error) {
        logger_1.logger.error('Get count by folio error:', error);
        res.status(500).json({ error: 'Failed to get count' });
    }
};
exports.getCountByFolio = getCountByFolio;
/**
 * Lista conteos con filtros
 * GET /api/counts?branch_id=1&status=pendiente&...
 */
const listCounts = async (req, res) => {
    try {
        const allowedStatuses = ['pendiente', 'contando', 'contado', 'cerrado', 'cancelado'];
        const rawStatus = req.query.status;
        const statusValues = rawStatus === undefined
            ? []
            : Array.isArray(rawStatus)
                ? rawStatus.flatMap((value) => String(value).split(',').map((entry) => entry.trim()).filter(Boolean))
                : String(rawStatus).split(',').map((entry) => entry.trim()).filter(Boolean);
        const invalidStatus = statusValues.find((value) => !allowedStatuses.includes(value));
        if (invalidStatus) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        const filters = {
            branch_id: req.query.branch_id ? parseInt(req.query.branch_id) : undefined,
            status: statusValues.length === 1 ? statusValues[0] : undefined,
            statuses: statusValues.length > 1 ? statusValues : undefined,
            type: req.query.type,
            classification: req.query.classification,
            responsible_user_id: req.query.responsible_user_id
                ? parseInt(req.query.responsible_user_id)
                : undefined,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            scheduled_from: req.query.scheduled_from,
            scheduled_to: req.query.scheduled_to,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };
        const result = await countsService.listCounts(filters);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('List counts error:', error);
        res.status(500).json({ error: 'Failed to list counts' });
    }
};
exports.listCounts = listCounts;
/**
 * Actualiza un conteo
 * PUT /api/counts/:id
 */
const updateCount = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = req.body;
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const count = await countsService.updateCount(id, data, userId);
        res.json(count);
    }
    catch (error) {
        logger_1.logger.error('Update count error:', error);
        if (error instanceof Error) {
            if (error.message === 'Count already started') {
                res.status(409).json({ error: 'El conteo ya fue iniciado por otro usuario' });
                return;
            }
            if (error.message === 'Invalid status transition') {
                res.status(400).json({ error: 'Transición de estado inválida' });
                return;
            }
            if (error.message === 'Count not found') {
                res.status(404).json({ error: 'Count not found' });
                return;
            }
        }
        res.status(500).json({ error: 'Failed to update count' });
    }
};
exports.updateCount = updateCount;
/**
 * Crea solicitudes de ajuste a partir de un conteo cerrado
 * POST /api/counts/:id/requests
 */
const createRequestsFromCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const countId = parseInt(req.params.id);
        if (isNaN(countId)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        const result = await countsService.createRequestsFromCount(countId, userId);
        res.json({ count_id: countId, ...result });
    }
    catch (error) {
        logger_1.logger.error('Create requests from count error:', error);
        if (error instanceof Error) {
            if (error.message === 'Count not found') {
                res.status(404).json({ error: 'Count not found' });
                return;
            }
            if (error.message === 'Count must be closed') {
                res.status(400).json({ error: 'El conteo debe estar cerrado para generar solicitudes' });
                return;
            }
            if (error.message.startsWith('Too many differences')) {
                res.status(400).json({ error: error.message });
                return;
            }
        }
        res.status(500).json({ error: 'Failed to create requests' });
    }
};
exports.createRequestsFromCount = createRequestsFromCount;
/**
 * Obtiene los detalles de un conteo
 * GET /api/counts/:id/details
 */
const getCountDetails = async (req, res) => {
    try {
        const countId = parseInt(req.params.id);
        if (isNaN(countId)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        const details = await countsService.getCountDetails(countId);
        res.json(details);
    }
    catch (error) {
        logger_1.logger.error('Get count details error:', error);
        res.status(500).json({ error: 'Failed to get count details' });
    }
};
exports.getCountDetails = getCountDetails;
/**
 * Agrega un detalle al conteo
 * POST /api/counts/:id/details
 */
const addCountDetail = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const countId = parseInt(req.params.id);
        const data = req.body;
        if (isNaN(countId)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        if (!data.item_code || data.counted_stock === undefined) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const detail = await countsService.addCountDetail(countId, userId, data);
        res.status(201).json(detail);
    }
    catch (error) {
        logger_1.logger.error('Add count detail error:', error);
        res.status(500).json({ error: 'Failed to add count detail' });
    }
};
exports.addCountDetail = addCountDetail;
/**
 * Actualiza un detalle de conteo
 * PUT /api/counts/details/:id
 */
const updateCountDetail = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = req.body;
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid detail ID' });
            return;
        }
        if (data.counted_stock === undefined) {
            res.status(400).json({ error: 'counted_stock is required' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const detail = await countsService.updateCountDetail(id, data, userId);
        res.json(detail);
    }
    catch (error) {
        logger_1.logger.error('Update count detail error:', error);
        res.status(500).json({ error: 'Failed to update count detail' });
    }
};
exports.updateCountDetail = updateCountDetail;
/**
 * Obtiene estadísticas del dashboard
 * GET /api/counts/stats/dashboard
 */
const getDashboardStats = async (_req, res) => {
    try {
        const stats = await countsService.getDashboardStats();
        res.json(stats);
    }
    catch (error) {
        logger_1.logger.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
};
exports.getDashboardStats = getDashboardStats;
/**
 * Lista diferencias de conteos
 * GET /api/counts/differences
 */
const listDifferences = async (_req, res) => {
    try {
        const diffs = await countsService.listDifferences();
        res.json(diffs);
    }
    catch (error) {
        logger_1.logger.error('List differences error:', error);
        res.status(500).json({ error: 'Failed to list differences' });
    }
};
exports.listDifferences = listDifferences;
/**
 * Elimina un conteo
 * DELETE /api/counts/:id
 */
const deleteCount = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid count ID' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        await countsService.deleteCount(id, userId);
        res.json({ message: 'Count deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Delete count error:', error);
        res.status(500).json({ error: 'Failed to delete count' });
    }
};
exports.deleteCount = deleteCount;
exports.default = {
    createCount: exports.createCount,
    getCount: exports.getCount,
    getCountByFolio: exports.getCountByFolio,
    listCounts: exports.listCounts,
    updateCount: exports.updateCount,
    getItemsHistory: exports.getItemsHistory,
    createRequestsFromCount: exports.createRequestsFromCount,
    getCountDetails: exports.getCountDetails,
    addCountDetail: exports.addCountDetail,
    updateCountDetail: exports.updateCountDetail,
    getDashboardStats: exports.getDashboardStats,
    listDifferences: exports.listDifferences,
    deleteCount: exports.deleteCount
};
//# sourceMappingURL=countsController.js.map