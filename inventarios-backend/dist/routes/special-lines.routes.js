"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const SpecialLinesService_1 = require("../services/SpecialLinesService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authMiddleware);
/**
 * GET /api/special-lines
 * Obtiene todas las líneas especiales
 */
router.get('/', async (req, res) => {
    try {
        const activeOnly = req.query.active === 'true';
        const lines = activeOnly
            ? await SpecialLinesService_1.specialLinesService.getActive()
            : await SpecialLinesService_1.specialLinesService.getAll();
        return res.json({ lines });
    }
    catch (error) {
        logger_1.logger.error('Error getting special lines:', error);
        return res.status(500).json({
            error: 'Error al obtener las líneas especiales'
        });
    }
});
/**
 * GET /api/special-lines/:id
 * Obtiene una línea especial por ID
 */
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const line = await SpecialLinesService_1.specialLinesService.getById(id);
        if (!line) {
            return res.status(404).json({ error: 'Línea especial no encontrada' });
        }
        return res.json(line);
    }
    catch (error) {
        logger_1.logger.error('Error getting special line:', error);
        return res.status(500).json({
            error: 'Error al obtener la línea especial'
        });
    }
});
/**
 * POST /api/special-lines
 * Crea una nueva línea especial
 */
router.post('/', async (req, res) => {
    try {
        const { line_code, line_name, tolerance_percentage, whatsapp_numbers, is_active } = req.body;
        if (!line_code) {
            return res.status(400).json({ error: 'El código de línea es requerido' });
        }
        const userId = req.user?.id;
        const line = await SpecialLinesService_1.specialLinesService.create({
            line_code,
            line_name,
            tolerance_percentage,
            whatsapp_numbers,
            is_active
        }, userId);
        return res.status(201).json(line);
    }
    catch (error) {
        logger_1.logger.error('Error creating special line:', error);
        return res.status(400).json({
            error: error.message || 'Error al crear la línea especial'
        });
    }
});
/**
 * PUT /api/special-lines/:id
 * Actualiza una línea especial
 */
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const { line_name, tolerance_percentage, whatsapp_numbers, is_active } = req.body;
        const userId = req.user?.id;
        const line = await SpecialLinesService_1.specialLinesService.update(id, {
            line_name,
            tolerance_percentage,
            whatsapp_numbers,
            is_active
        }, userId);
        return res.json(line);
    }
    catch (error) {
        logger_1.logger.error('Error updating special line:', error);
        return res.status(400).json({
            error: error.message || 'Error al actualizar la línea especial'
        });
    }
});
/**
 * DELETE /api/special-lines/:id
 * Elimina una línea especial
 */
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const userId = req.user?.id;
        await SpecialLinesService_1.specialLinesService.delete(id, userId);
        return res.json({ message: 'Línea especial eliminada correctamente' });
    }
    catch (error) {
        logger_1.logger.error('Error deleting special line:', error);
        return res.status(500).json({
            error: 'Error al eliminar la línea especial'
        });
    }
});
/**
 * POST /api/special-lines/:id/toggle
 * Activa o desactiva una línea especial
 */
router.post('/:id/toggle', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active debe ser un booleano' });
        }
        const userId = req.user?.id;
        const line = await SpecialLinesService_1.specialLinesService.toggleActive(id, is_active, userId);
        return res.json(line);
    }
    catch (error) {
        logger_1.logger.error('Error toggling special line:', error);
        return res.status(500).json({
            error: 'Error al cambiar el estado de la línea especial'
        });
    }
});
exports.default = router;
//# sourceMappingURL=special-lines.routes.js.map