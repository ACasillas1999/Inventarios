"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingsController_1 = require("../controllers/settingsController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/settings
 * @desc    Obtener todas las configuraciones
 * @access  Private (Admin)
 */
router.get('/', auth_1.authMiddleware, (0, auth_1.requirePermission)('all'), settingsController_1.settingsController.getAll);
/**
 * @route   GET /api/settings/:key
 * @desc    Obtener una configuración específica
 * @access  Private (Admin)
 */
router.get('/:key', auth_1.authMiddleware, (0, auth_1.requirePermission)('all'), settingsController_1.settingsController.getByKey);
/**
 * @route   PATCH /api/settings
 * @desc    Actualizar configuraciones
 * @access  Private (Admin)
 */
router.patch('/', auth_1.authMiddleware, (0, auth_1.requirePermission)('all'), settingsController_1.settingsController.update);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map