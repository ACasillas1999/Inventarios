import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import usersController from '../controllers/usersController'

const router = Router()

router.use(authMiddleware)

router.get('/', usersController.listUsers)
router.post('/', usersController.createUser)
router.patch('/:id', usersController.updateUserStatus)
router.post('/:id/change-password', usersController.changeUserPassword)

export default router
