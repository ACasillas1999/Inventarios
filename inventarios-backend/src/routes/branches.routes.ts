import { Router, Request, Response } from 'express'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { ConnectionManager } from '../connections/ConnectionManager'
import { branchesService } from '../services/BranchesService'
import { logger } from '../utils/logger'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)

/**
 * Lista todas las sucursales con su estado de conexión
 * GET /api/branches
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const connectionManager = ConnectionManager.getInstance()
    const statuses = connectionManager.getBranchesStatus()
    return res.json(statuses)
  } catch (error) {
    logger.error('Get branches error:', error)
    return res.status(500).json({ error: 'Failed to get branches' })
  }
})

/**
 * Obtiene el detalle de una sucursal (incluye credenciales para admin)
 * GET /api/branches/list/full
 */
router.get('/list/full', requirePermission('all'), async (_req: Request, res: Response) => {
  try {
    const branches = await branchesService.getAllFromDb()
    return res.json(branches)
  } catch (error) {
    logger.error('Get full branches list error:', error)
    return res.status(500).json({ error: 'Failed to get branches full list' })
  }
})

/**
 * Crea una nueva sucursal
 * POST /api/branches
 */
router.post('/', requirePermission('all'), async (req: Request, res: Response) => {
  try {
    const newId = await branchesService.create(req.body)
    return res.status(201).json({ id: newId, message: 'Sucursal creada y conectada correctamente' })
  } catch (error: any) {
    logger.error('Create branch error:', error)
    return res.status(500).json({ error: error.message || 'Failed to create branch' })
  }
})

/**
 * Actualiza una sucursal
 * PUT /api/branches/:id
 */
router.put('/:id', requirePermission('all'), async (req: Request, res: Response) => {
  try {
    const branchId = parseInt(req.params.id)
    await branchesService.update(branchId, req.body)
    return res.json({ message: 'Sucursal actualizada y reconectada correctamente' })
  } catch (error: any) {
    logger.error('Update branch error:', error)
    return res.status(500).json({ error: error.message || 'Failed to update branch' })
  }
})

/**
 * Elimina una sucursal
 * DELETE /api/branches/:id
 */
router.delete('/:id', requirePermission('all'), async (req: Request, res: Response) => {
  try {
    const branchId = parseInt(req.params.id)
    await branchesService.delete(branchId)
    return res.json({ message: 'Sucursal eliminada correctamente' })
  } catch (error: any) {
    logger.error('Delete branch error:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete branch' })
  }
})

/**
 * Verifica el estado de salud de una sucursal
 * GET /api/branches/:id/health
 */
router.get('/:id/health', async (req: Request, res: Response) => {
  try {
    const branchId = parseInt(req.params.id)

    if (isNaN(branchId)) {
      return res.status(400).json({ error: 'Invalid branch ID' })
    }

    const connectionManager = ConnectionManager.getInstance()
    const isHealthy = await connectionManager.checkBranchHealth(branchId)

    return res.json({
      branch_id: branchId,
      healthy: isHealthy
    })
  } catch (error) {
    logger.error('Check branch health error:', error)
    return res.status(500).json({ error: 'Failed to check branch health' })
  }
})

/**
 * Obtiene la lista de almacenes de una sucursal
 * GET /api/branches/:id/warehouses
 */
router.get('/:id/warehouses', async (req: Request, res: Response) => {
  try {
    const branchId = parseInt(req.params.id)

    if (isNaN(branchId)) {
      return res.status(400).json({ error: 'Invalid branch ID' })
    }

    const connectionManager = ConnectionManager.getInstance()

    // Obtener configuración de conexión para debug
    const configs = connectionManager.getAllBranchConfigs()
    const currentConfig = configs.find(c => c.id === branchId)

    if (currentConfig) {
      logger.info(`DEBUG: Connecting to Branch ${branchId} at HOST: ${currentConfig.host}, DB: ${currentConfig.database}`)
    }

    const query = `
      SELECT 
        Almacen as id,
        Nombre as name,
        Habilitado as habilitado
      FROM almacenes
      ORDER BY Almacen ASC
    `

    type WarehouseRow = {
      id: number
      name: string
      habilitado: number
    }

    const warehouses = await connectionManager.executeQuery<WarehouseRow>(
      branchId,
      query,
      []
    )

    const enabled = warehouses.filter(w => w.habilitado === 1)

    return res.json({
      warehouses: enabled,
      debug_info: {
        host: currentConfig?.host,
        database: currentConfig?.database,
        all_warehouses_count: warehouses.length,
        enabled_count: enabled.length
      }
    })
  } catch (error: any) {
    logger.error('Get warehouses error:', error)
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(404).json({ error: 'Warehouses table not found in branch database' })
    }
    return res.status(500).json({ error: 'Failed to get warehouses' })
  }
})

/**
 * Verifica el estado de salud de todas las sucursales
 * GET /api/branches/health/all
 */
router.get('/health/all', async (_req: Request, res: Response) => {
  try {
    const connectionManager = ConnectionManager.getInstance()
    const healthStatus = await connectionManager.checkAllBranchesHealth()

    const results = Array.from(healthStatus.entries()).map(([branchId, isHealthy]) => ({
      branch_id: branchId,
      healthy: isHealthy
    }))

    return res.json(results)
  } catch (error) {
    logger.error('Check all branches health error:', error)
    return res.status(500).json({ error: 'Failed to check all branches health' })
  }
})

export default router
