import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import auditController from '../controllers/auditController'

const router = Router()

router.use(authMiddleware)

router.get('/', auditController.listAuditLogs)

export default router
