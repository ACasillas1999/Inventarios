import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import usersController from '../controllers/usersController'

const router = Router()

router.use(authMiddleware)

router.get('/', usersController.listUsers)
router.post('/', usersController.createUser)
router.put('/:id', usersController.updateUser)
router.patch('/:id', usersController.updateUserStatus)
router.put('/:id/notifications', usersController.updateUserNotifications)
router.post('/:id/change-password', usersController.changeUserPassword)

export default router
