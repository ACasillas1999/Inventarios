import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import reportsController from '../controllers/reportsController'

const router = Router()

router.use(authMiddleware)

router.get('/audit', reportsController.getAuditKPIs)
router.get('/company-overview', reportsController.getCompanyOverview)
router.get('/coverage', reportsController.getCoverageReport)
router.get('/line-stats', reportsController.getLineStats)
router.get('/productivity', reportsController.getProductivityStats)

export default router
