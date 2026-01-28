import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import rolesController from '../controllers/rolesController'

const router = Router()

// Todas las rutas de roles requieren autenticación
router.use(authMiddleware)

router.get('/', rolesController.listRoles)
router.get('/:id', rolesController.getRole)
router.put('/:id', rolesController.updateRolePermissions)

export default router
