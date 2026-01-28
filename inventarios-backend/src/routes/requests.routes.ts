import { Router } from 'express'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import requestsController from '../controllers/requestsController'

const router = Router()

router.use(authMiddleware)

router.get('/', requestsController.listRequests)
router.get('/:id', requestsController.getRequest)
router.patch('/:id', requirePermission('requests.update'), requestsController.updateRequest)

export default router
