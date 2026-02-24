"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const ConnectionManager_1 = require("../connections/ConnectionManager");
const BranchesService_1 = require("../services/BranchesService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authMiddleware);
/**
 * Lista todas las sucursales con su estado de conexión
 * GET /api/branches
 */
router.get('/', async (_req, res) => {
    try {
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const statuses = connectionManager.getBranchesStatus();
        return res.json(statuses);
    }
    catch (error) {
        logger_1.logger.error('Get branches error:', error);
        return res.status(500).json({ error: 'Failed to get branches' });
    }
});
/**
 * Obtiene el detalle de una sucursal (incluye credenciales para admin)
 * GET /api/branches/list/full
 */
router.get('/list/full', (0, auth_1.requirePermission)('all'), async (_req, res) => {
    try {
        const branches = await BranchesService_1.branchesService.getAllFromDb();
        return res.json(branches);
    }
    catch (error) {
        logger_1.logger.error('Get full branches list error:', error);
        return res.status(500).json({ error: 'Failed to get branches full list' });
    }
});
/**
 * Crea una nueva sucursal
 * POST /api/branches
 */
router.post('/', (0, auth_1.requirePermission)('all'), async (req, res) => {
    try {
        const newId = await BranchesService_1.branchesService.create(req.body);
        return res.status(201).json({ id: newId, message: 'Sucursal creada y conectada correctamente' });
    }
    catch (error) {
        logger_1.logger.error('Create branch error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create branch' });
    }
});
/**
 * Actualiza una sucursal
 * PUT /api/branches/:id
 */
router.put('/:id', (0, auth_1.requirePermission)('all'), async (req, res) => {
    try {
        const branchId = parseInt(req.params.id);
        await BranchesService_1.branchesService.update(branchId, req.body);
        return res.json({ message: 'Sucursal actualizada y reconectada correctamente' });
    }
    catch (error) {
        logger_1.logger.error('Update branch error:', error);
        return res.status(500).json({ error: error.message || 'Failed to update branch' });
    }
});
/**
 * Elimina una sucursal
 * DELETE /api/branches/:id
 */
router.delete('/:id', (0, auth_1.requirePermission)('all'), async (req, res) => {
    try {
        const branchId = parseInt(req.params.id);
        await BranchesService_1.branchesService.delete(branchId);
        return res.json({ message: 'Sucursal eliminada correctamente' });
    }
    catch (error) {
        logger_1.logger.error('Delete branch error:', error);
        return res.status(500).json({ error: error.message || 'Failed to delete branch' });
    }
});
/**
 * Verifica el estado de salud de una sucursal
 * GET /api/branches/:id/health
 */
router.get('/:id/health', async (req, res) => {
    try {
        const branchId = parseInt(req.params.id);
        if (isNaN(branchId)) {
            return res.status(400).json({ error: 'Invalid branch ID' });
        }
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const isHealthy = await connectionManager.checkBranchHealth(branchId);
        return res.json({
            branch_id: branchId,
            healthy: isHealthy
        });
    }
    catch (error) {
        logger_1.logger.error('Check branch health error:', error);
        return res.status(500).json({ error: 'Failed to check branch health' });
    }
});
/**
 * Obtiene la lista de almacenes de una sucursal
 * GET /api/branches/:id/warehouses
 */
router.get('/:id/warehouses', async (req, res) => {
    try {
        const branchId = parseInt(req.params.id);
        if (isNaN(branchId)) {
            return res.status(400).json({ error: 'Invalid branch ID' });
        }
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        // Obtener configuración de conexión para debug
        const configs = connectionManager.getAllBranchConfigs();
        const currentConfig = configs.find(c => c.id === branchId);
        if (currentConfig) {
            logger_1.logger.info(`DEBUG: Connecting to Branch ${branchId} at HOST: ${currentConfig.host}, DB: ${currentConfig.database}`);
        }
        const queryWithEnabled = `
      SELECT 
        Almacen as id,
        Nombre as name,
        Habilitado as habilitado
      FROM almacenes
      ORDER BY Almacen ASC
    `;
        const fallbackQuery = `
      SELECT 
        Almacen as id,
        Nombre as name,
        1 as habilitado
      FROM almacenes
      ORDER BY Almacen ASC
    `;
        let warehouses = [];
        try {
            warehouses = await connectionManager.executeQuery(branchId, queryWithEnabled, []);
        }
        catch (error) {
            if (error?.code === 'ER_BAD_FIELD_ERROR' || error?.sqlState === '42S22') {
                logger_1.logger.warn('Warehouses table has no Habilitado column. Returning all as enabled.', {
                    branch_id: branchId
                });
                warehouses = await connectionManager.executeQuery(branchId, fallbackQuery, []);
            }
            else {
                throw error;
            }
        }
        const enabled = warehouses.filter(w => w.habilitado === 1);
        return res.json({
            warehouses: enabled,
            debug_info: {
                host: currentConfig?.host,
                database: currentConfig?.database,
                all_warehouses_count: warehouses.length,
                enabled_count: enabled.length
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get warehouses error:', error);
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return res.status(404).json({ error: 'Warehouses table not found in branch database' });
        }
        return res.status(500).json({ error: 'Failed to get warehouses' });
    }
});
/**
 * Verifica el estado de salud de todas las sucursales
 * GET /api/branches/health/all
 */
router.get('/health/all', async (_req, res) => {
    try {
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const healthStatus = await connectionManager.checkAllBranchesHealth();
        const results = Array.from(healthStatus.entries()).map(([branchId, isHealthy]) => ({
            branch_id: branchId,
            healthy: isHealthy
        }));
        return res.json(results);
    }
    catch (error) {
        logger_1.logger.error('Check all branches health error:', error);
        return res.status(500).json({ error: 'Failed to check all branches health' });
    }
});
exports.default = router;
//# sourceMappingURL=branches.routes.js.map