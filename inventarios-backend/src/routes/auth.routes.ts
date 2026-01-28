import { Router } from 'express'
import authController from '../controllers/authController'
import { authMiddleware } from '../middlewares/auth'

const router = Router()

// Rutas públicas
router.post('/login', authController.login)

// Rutas protegidas
router.get('/profile', authMiddleware, authController.getProfile)
router.post('/change-password', authMiddleware, authController.changePassword)

export default router
