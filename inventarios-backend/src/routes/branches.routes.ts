import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/auth'
import { ConnectionManager } from '../connections/ConnectionManager'
import { logger } from '../utils/logger'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)

/**
 * Lista todas las sucursales con su estado de conexión
 * GET /api/branches
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const connectionManager = ConnectionManager.getInstance()
    const statuses = connectionManager.getBranchesStatus()

    res.json(statuses)
  } catch (error) {
    logger.error('Get branches error:', error)
    res.status(500).json({ error: 'Failed to get branches' })
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
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const connectionManager = ConnectionManager.getInstance()
    const isHealthy = await connectionManager.checkBranchHealth(branchId)

    res.json({
      branch_id: branchId,
      healthy: isHealthy
    })
  } catch (error) {
    logger.error('Check branch health error:', error)
    res.status(500).json({ error: 'Failed to check branch health' })
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
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const connectionManager = ConnectionManager.getInstance()

    // Obtener configuración de conexión para debug
    const configs = connectionManager.getAllBranchConfigs()
    const currentConfig = configs.find(c => c.id === branchId)

    if (currentConfig) {
      logger.info(`DEBUG: Connecting to Branch ${branchId} at HOST: ${currentConfig.host}, DB: ${currentConfig.database}`)
    } else {
      logger.warn(`DEBUG: Could not find config for Branch ${branchId}`)
    }

    // Consulta modificada para debug: traer todo y ver el estado Habilitado
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

    logger.info(`DEBUG: Found ${warehouses.length} warehouses for Branch ${branchId}`)

    // Filtrar en memoria por ahora para asegurar lo que enviamos, pero loguear antes
    const enabled = warehouses.filter(w => w.habilitado === 1)

    res.json({
      warehouses: enabled, // Enviamos solo habilitados como pide el usuario
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
      res.status(404).json({ error: 'Warehouses table not found in branch database' })
      return
    }
    res.status(500).json({ error: 'Failed to get warehouses' })
  }
})

/**
 * Verifica el estado de salud de todas las sucursales
 * GET /api/branches/health/all
 */
router.get('/health/all', async (req: Request, res: Response) => {
  try {
    const connectionManager = ConnectionManager.getInstance()
    const healthStatus = await connectionManager.checkAllBranchesHealth()

    const results = Array.from(healthStatus.entries()).map(([branchId, isHealthy]) => ({
      branch_id: branchId,
      healthy: isHealthy
    }))

    res.json(results)
  } catch (error) {
    logger.error('Check all branches health error:', error)
    res.status(500).json({ error: 'Failed to check all branches health' })
  }
})

export default router
