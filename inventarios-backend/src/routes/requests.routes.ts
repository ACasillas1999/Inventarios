import { Router } from 'express'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import requestsController from '../controllers/requestsController'
import commentsController from '../controllers/commentsController'

const router = Router()

router.use(authMiddleware)

router.get('/', requestsController.listRequests)
router.get('/:id', requestsController.getRequest)
router.patch('/:id', requirePermission('requests.update'), requestsController.updateRequest)

// Comments (chat en vivo)
router.get('/:id/comments', commentsController.listComments)
router.post('/:id/comments', commentsController.createComment)

export default router

