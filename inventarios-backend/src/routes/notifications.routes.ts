import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import notificationsController from '../controllers/notificationsController'

const router = Router()
router.use(authMiddleware)

router.get('/', notificationsController.listNotifications)
router.post('/read-all', notificationsController.markAllNotificationsRead)
router.post('/read-for-entity', notificationsController.markNotificationsReadForEntity)
router.post('/:id/read', notificationsController.markNotificationRead)

export default router
