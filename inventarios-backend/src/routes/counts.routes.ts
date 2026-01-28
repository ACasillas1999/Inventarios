import { Router } from 'express'
import countsController from '../controllers/countsController'
import { authMiddleware, requirePermission } from '../middlewares/auth'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)

// Estadísticas
router.get('/stats/dashboard', countsController.getDashboardStats)
router.get('/differences', countsController.listDifferences)
router.post('/history/items', countsController.getItemsHistory)

// CRUD de conteos
router.post('/', requirePermission('counts.create'), countsController.createCount)
router.get('/', countsController.listCounts)
router.get('/folio/:folio', countsController.getCountByFolio)
router.get('/:id', countsController.getCount)
router.put('/:id', requirePermission('counts.update'), countsController.updateCount)
router.post('/:id/requests', requirePermission('requests.create'), countsController.createRequestsFromCount)
router.delete('/:id', requirePermission('all'), countsController.deleteCount)

// Detalles de conteos
router.get('/:id/details', countsController.getCountDetails)
router.post('/:id/details', countsController.addCountDetail)
router.put('/details/:id', countsController.updateCountDetail)

export default router
