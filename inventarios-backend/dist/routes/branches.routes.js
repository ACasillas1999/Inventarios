"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const ConnectionManager_1 = require("../connections/ConnectionManager");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authMiddleware);
/**
 * Lista todas las sucursales con su estado de conexión
 * GET /api/branches
 */
router.get('/', async (req, res) => {
    try {
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const statuses = connectionManager.getBranchesStatus();
        res.json(statuses);
    }
    catch (error) {
        logger_1.logger.error('Get branches error:', error);
        res.status(500).json({ error: 'Failed to get branches' });
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
            res.status(400).json({ error: 'Invalid branch ID' });
            return;
        }
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const isHealthy = await connectionManager.checkBranchHealth(branchId);
        res.json({
            branch_id: branchId,
            healthy: isHealthy
        });
    }
    catch (error) {
        logger_1.logger.error('Check branch health error:', error);
        res.status(500).json({ error: 'Failed to check branch health' });
    }
});
/**
 * Verifica el estado de salud de todas las sucursales
 * GET /api/branches/health/all
 */
router.get('/health/all', async (req, res) => {
    try {
        const connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
        const healthStatus = await connectionManager.checkAllBranchesHealth();
        const results = Array.from(healthStatus.entries()).map(([branchId, isHealthy]) => ({
            branch_id: branchId,
            healthy: isHealthy
        }));
        res.json(results);
    }
    catch (error) {
        logger_1.logger.error('Check all branches health error:', error);
        res.status(500).json({ error: 'Failed to check all branches health' });
    }
});
exports.default = router;
//# sourceMappingURL=branches.routes.js.map