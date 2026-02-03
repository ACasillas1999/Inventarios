import { Router } from 'express'
import { settingsController } from '../controllers/settingsController'
import { authMiddleware, requirePermission } from '../middlewares/auth'

const router = Router()

/**
 * @route   GET /api/settings
 * @desc    Obtener todas las configuraciones
 * @access  Private (Admin)
 */
router.get('/', authMiddleware, requirePermission('all'), settingsController.getAll)

/**
 * @route   GET /api/settings/:key
 * @desc    Obtener una configuración específica
 * @access  Private (Admin)
 */
router.get('/:key', authMiddleware, requirePermission('all'), settingsController.getByKey)

/**
 * @route   PATCH /api/settings
 * @desc    Actualizar configuraciones
 * @access  Private (Admin)
 */
router.patch('/', authMiddleware, requirePermission('all'), settingsController.update)

export default router
