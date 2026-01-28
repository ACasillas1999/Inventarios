import { Router } from 'express'
import stockController from '../controllers/stockController'
import { authMiddleware } from '../middlewares/auth'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)

// Consultas de artículos
router.get('/:branchId/item/:itemCode/warehouses', stockController.getItemWarehousesStock)
router.get('/:branchId/item/:itemCode', stockController.getItemInfo)
router.get('/:branchId/warehouses', stockController.getWarehouses)
router.get('/:branchId/lines', stockController.getLines)
router.get('/:branchId/item-codes', stockController.getItemCodes)
router.get('/:branchId/items', stockController.searchItems)

// Consultas de existencias
// Nota: rutas más específicas van antes para evitar que /items machee con :itemCode
router.get('/:branchId/:itemCode', stockController.getStock)
router.post('/:branchId/batch', stockController.getBatchStock)
router.get('/all/:itemCode', stockController.getStockAllBranches)
router.post('/compare', stockController.compareStock)

// Gestión de caché
router.delete('/cache/:branchId/:itemCode?', stockController.invalidateCache)

export default router
