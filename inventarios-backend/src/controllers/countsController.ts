import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import CountsService from '../services/CountsService'
import { logger } from '../utils/logger'
import { CreateCountRequest, UpdateCountRequest, CreateCountDetailRequest } from '../types'

const countsService = new CountsService()

/**
 * Crea un nuevo conteo
 * POST /api/counts
 */
export const createCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const data: CreateCountRequest = req.body

    if (!data.branch_id || !data.type || !data.responsible_user_id) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const counts = await countsService.createCount(userId, data)

    res.status(201).json({
      counts,
      total_created: counts.length,
      folios: counts.map(c => c.folio)
    })
  } catch (error) {
    logger.error('Create count error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create count'
    if (typeof message === 'string' && (message.startsWith('Too many items') || message.includes('No items found'))) {
      res.status(400).json({ error: message })
      return
    }
    res.status(500).json({ error: message })
  }
}

/**
 * Historial de artículos contados en un rango (por sucursal)
 * POST /api/counts/history/items
 */
export const getItemsHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = Number(req.body?.branch_id)
    const itemCodes = Array.isArray(req.body?.item_codes) ? (req.body.item_codes as string[]) : []
    const from = req.body?.from ? String(req.body.from) : ''
    const to = req.body?.to ? String(req.body.to) : ''
    const almacen = req.body?.almacen ? Number(req.body.almacen) : undefined

    if (!Number.isFinite(branchId) || branchId <= 0) {
      res.status(400).json({ error: 'Invalid branch_id' })
      return
    }
    if (!from || !to) {
      res.status(400).json({ error: 'from/to are required' })
      return
    }
    if (itemCodes.length === 0) {
      res.json({ branch_id: branchId, from, to, almacen, items: [] })
      return
    }

    const items = await countsService.getItemsHistory(branchId, itemCodes, from, to, almacen)
    res.json({ branch_id: branchId, from, to, almacen, items })
  } catch (error) {
    logger.error('Get items history error:', error)
    res.status(500).json({ error: 'Failed to get items history' })
  }
}

/**
 * Obtiene un conteo por ID
 * GET /api/counts/:id
 */
export const getCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    const count = await countsService.getCountById(id)

    if (!count) {
      res.status(404).json({ error: 'Count not found' })
      return
    }

    res.json(count)
  } catch (error) {
    logger.error('Get count error:', error)
    res.status(500).json({ error: 'Failed to get count' })
  }
}

/**
 * Obtiene un conteo por folio
 * GET /api/counts/folio/:folio
 */
export const getCountByFolio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const folio = req.params.folio

    const count = await countsService.getCountByFolio(folio)

    if (!count) {
      res.status(404).json({ error: 'Count not found' })
      return
    }

    res.json(count)
  } catch (error) {
    logger.error('Get count by folio error:', error)
    res.status(500).json({ error: 'Failed to get count' })
  }
}

/**
 * Lista conteos con filtros
 * GET /api/counts?branch_id=1&status=pendiente&...
 */
export const listCounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedStatuses = ['pendiente', 'contando', 'contado', 'cerrado', 'cancelado']
    const rawStatus = req.query.status
    const statusValues =
      rawStatus === undefined
        ? []
        : Array.isArray(rawStatus)
          ? rawStatus.flatMap((value) => String(value).split(',').map((entry) => entry.trim()).filter(Boolean))
          : String(rawStatus).split(',').map((entry) => entry.trim()).filter(Boolean)

    const invalidStatus = statusValues.find((value) => !allowedStatuses.includes(value))
    if (invalidStatus) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const filters = {
      branch_id: req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined,
      status: statusValues.length === 1 ? statusValues[0] : undefined,
      statuses: statusValues.length > 1 ? statusValues : undefined,
      type: req.query.type as string | undefined,
      classification: req.query.classification as string | undefined,
      responsible_user_id: req.query.responsible_user_id
        ? parseInt(req.query.responsible_user_id as string)
        : undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      scheduled_from: req.query.scheduled_from as string | undefined,
      scheduled_to: req.query.scheduled_to as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    }

    const result = await countsService.listCounts(filters)

    res.json(result)
  } catch (error) {
    logger.error('List counts error:', error)
    res.status(500).json({ error: 'Failed to list counts' })
  }
}

/**
 * Actualiza un conteo
 * PUT /api/counts/:id
 */
export const updateCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const data: UpdateCountRequest = req.body

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const count = await countsService.updateCount(id, data, userId)

    res.json(count)
  } catch (error) {
    logger.error('Update count error:', error)
    if (error instanceof Error) {
      if (error.message === 'Count already started') {
        res.status(409).json({ error: 'El conteo ya fue iniciado por otro usuario' })
        return
      }
      if (error.message === 'Invalid status transition') {
        res.status(400).json({ error: 'Transición de estado inválida' })
        return
      }
      if (error.message === 'Count not found') {
        res.status(404).json({ error: 'Count not found' })
        return
      }
    }
    res.status(500).json({ error: 'Failed to update count' })
  }
}

/**
 * Crea solicitudes de ajuste a partir de un conteo cerrado
 * POST /api/counts/:id/requests
 */
export const createRequestsFromCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const countId = parseInt(req.params.id)
    if (isNaN(countId)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    const result = await countsService.createRequestsFromCount(countId, userId)
    res.json({ count_id: countId, ...result })
  } catch (error) {
    logger.error('Create requests from count error:', error)
    if (error instanceof Error) {
      if (error.message === 'Count not found') {
        res.status(404).json({ error: 'Count not found' })
        return
      }
      if (error.message === 'Count must be closed') {
        res.status(400).json({ error: 'El conteo debe estar cerrado para generar solicitudes' })
        return
      }
      if (error.message.startsWith('Too many differences')) {
        res.status(400).json({ error: error.message })
        return
      }
    }
    res.status(500).json({ error: 'Failed to create requests' })
  }
}

/**
 * Obtiene los detalles de un conteo
 * GET /api/counts/:id/details
 */
export const getCountDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const countId = parseInt(req.params.id)

    if (isNaN(countId)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    const details = await countsService.getCountDetails(countId)

    res.json(details)
  } catch (error) {
    logger.error('Get count details error:', error)
    res.status(500).json({ error: 'Failed to get count details' })
  }
}

/**
 * Agrega un detalle al conteo
 * POST /api/counts/:id/details
 */
export const addCountDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const countId = parseInt(req.params.id)
    const data: CreateCountDetailRequest = req.body

    if (isNaN(countId)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    if (!data.item_code || data.counted_stock === undefined) {
      res.status(400).json({ error: 'Missing required fields' })
      return
    }

    const detail = await countsService.addCountDetail(countId, userId, data)

    res.status(201).json(detail)
  } catch (error) {
    logger.error('Add count detail error:', error)
    res.status(500).json({ error: 'Failed to add count detail' })
  }
}

/**
 * Actualiza un detalle de conteo
 * PUT /api/counts/details/:id
 */
export const updateCountDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const data = req.body

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid detail ID' })
      return
    }

    if (data.counted_stock === undefined) {
      res.status(400).json({ error: 'counted_stock is required' })
      return
    }

    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const detail = await countsService.updateCountDetail(id, data, userId)

    res.json(detail)
  } catch (error) {
    logger.error('Update count detail error:', error)
    res.status(500).json({ error: 'Failed to update count detail' })
  }
}

/**
 * Obtiene estadísticas del dashboard
 * GET /api/counts/stats/dashboard
 */
export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await countsService.getDashboardStats()

    res.json(stats)
  } catch (error) {
    logger.error('Get dashboard stats error:', error)
    res.status(500).json({ error: 'Failed to get dashboard stats' })
  }
}

/**
 * Lista diferencias de conteos
 * GET /api/counts/differences
 */
export const listDifferences = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const diffs = await countsService.listDifferences()
    res.json(diffs)
  } catch (error) {
    logger.error('List differences error:', error)
    res.status(500).json({ error: 'Failed to list differences' })
  }
}

/**
 * Elimina un conteo
 * DELETE /api/counts/:id
 */
export const deleteCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid count ID' })
      return
    }

    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    await countsService.deleteCount(id, userId)

    res.json({ message: 'Count deleted successfully' })
  } catch (error) {
    logger.error('Delete count error:', error)
    res.status(500).json({ error: 'Failed to delete count' })
  }
}

export default {
  createCount,
  getCount,
  getCountByFolio,
  listCounts,
  updateCount,
  getItemsHistory,
  createRequestsFromCount,
  getCountDetails,
  addCountDetail,
  updateCountDetail,
  getDashboardStats,
  listDifferences,
  deleteCount
}
