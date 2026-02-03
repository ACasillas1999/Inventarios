import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import StockService from '../services/StockService'
import { logger } from '../utils/logger'
import { StockCompareRequest, StockCompareResponse } from '../types'

const stockService = new StockService()

/**
 * Obtiene la existencia de un artículo en una sucursal
 * GET /api/stock/:branchId/:itemCode
 */
export const getStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const itemCode = req.params.itemCode

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const stock = await stockService.getStock(branchId, itemCode)

    res.json({
      branch_id: branchId,
      item_code: itemCode,
      stock
    })
  } catch (error) {
    logger.error('Get stock error:', error)
    res.status(500).json({ error: 'Failed to get stock' })
  }
}

/**
 * Obtiene las existencias de múltiples artículos en una sucursal
 * POST /api/stock/:branchId/batch
 * Body: { itemCodes: string[] }
 */
export const getBatchStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const { itemCodes } = req.body

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    if (!Array.isArray(itemCodes) || itemCodes.length === 0) {
      res.status(400).json({ error: 'itemCodes must be a non-empty array' })
      return
    }

    const stocks = await stockService.getBatchStock(branchId, itemCodes)

    const results = Array.from(stocks.entries()).map(([itemCode, stock]) => ({
      item_code: itemCode,
      stock
    }))

    res.json({
      branch_id: branchId,
      stocks: results
    })
  } catch (error) {
    logger.error('Get batch stock error:', error)
    res.status(500).json({ error: 'Failed to get batch stock' })
  }
}

/**
 * Obtiene las existencias de un artículo en todas las sucursales
 * GET /api/stock/all/:itemCode
 */
export const getStockAllBranches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const itemCode = req.params.itemCode

    const stocks = await stockService.getStockAllBranches(itemCode)

    res.json({
      item_code: itemCode,
      branches: stocks
    })
  } catch (error) {
    logger.error('Get stock all branches error:', error)
    res.status(500).json({ error: 'Failed to get stock from all branches' })
  }
}

/**
 * Compara stock del sistema vs stock contado
 * POST /api/stock/compare
 * Body: StockCompareRequest
 */
export const compareStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branch_id, items }: StockCompareRequest = req.body

    if (!branch_id || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'Invalid request body' })
      return
    }

    // Obtener tolerancia del sistema (podrías obtenerla de settings)
    const tolerancePercentage = 5.0

    const itemCodes = items.map((item) => item.item_code)
    const systemStocks = await stockService.getBatchStock(branch_id, itemCodes)

    const results: StockCompareResponse[] = items.map((item) => {
      const systemStock = systemStocks.get(item.item_code) || 0
      const countedStock = item.counted_stock
      const difference = countedStock - systemStock

      let differencePercentage = 0
      if (systemStock !== 0) {
        differencePercentage = (difference / systemStock) * 100
      } else if (countedStock !== 0) {
        differencePercentage = 100
      }

      const exceedsTolerance = Math.abs(differencePercentage) > tolerancePercentage

      return {
        item_code: item.item_code,
        system_stock: systemStock,
        counted_stock: countedStock,
        difference,
        difference_percentage: Number(differencePercentage.toFixed(2)),
        exceeds_tolerance: exceedsTolerance
      }
    })

    res.json({
      branch_id,
      tolerance_percentage: tolerancePercentage,
      comparisons: results,
      summary: {
        total_items: results.length,
        items_with_difference: results.filter((r) => r.difference !== 0).length,
        items_exceeding_tolerance: results.filter((r) => r.exceeds_tolerance).length
      }
    })
  } catch (error) {
    logger.error('Compare stock error:', error)
    res.status(500).json({ error: 'Failed to compare stock' })
  }
}

/**
 * Obtiene información completa de un artículo
 * GET /api/stock/:branchId/item/:itemCode
 */
export const getItemInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const itemCode = req.params.itemCode

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const item = await stockService.getItemInfo(branchId, itemCode)

    if (!item) {
      res.status(404).json({ error: 'Item not found' })
      return
    }

    res.json(item)
  } catch (error) {
    logger.error('Get item info error:', error)
    res.status(500).json({ error: 'Failed to get item info' })
  }
}

/**
 * Busca artículos en una sucursal
 * GET /api/stock/:branchId/items?search=xxx&linea=yyy&almacen=1&limit=50&offset=0
 */
export const searchItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const search = req.query.search as string | undefined
    const linea = req.query.linea as string | undefined
    const almacen = parseInt(req.query.almacen as string) || 1
    const limitParam = req.query.limit as string | undefined
    const offsetParam = req.query.offset as string | undefined
    const parsedLimit = limitParam !== undefined ? parseInt(limitParam) : NaN
    const parsedOffset = offsetParam !== undefined ? parseInt(offsetParam) : NaN
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.max(parsedLimit, 0)
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0)

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const items = await stockService.searchItems(branchId, search, linea, limit, offset, almacen)

    res.json({
      branch_id: branchId,
      items,
      pagination: {
        limit,
        offset,
        count: items.length
      }
    })
  } catch (error) {
    logger.error('Search items error:', error)
    res.status(500).json({ error: 'Failed to search items' })
  }
}

/**
 * Invalida el caché de un artículo o sucursal
 * DELETE /api/stock/cache/:branchId/:itemCode?
 */
export const invalidateCache = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const itemCode = req.params.itemCode

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    stockService.invalidateCache(branchId, itemCode)

    res.json({
      message: itemCode
        ? `Cache invalidated for branch ${branchId}, item ${itemCode}`
        : `All cache invalidated for branch ${branchId}`
    })
  } catch (error) {
    logger.error('Invalidate cache error:', error)
    res.status(500).json({ error: 'Failed to invalidate cache' })
  }
}

/**
 * Obtiene los almacenes disponibles en una sucursal
 * GET /api/stock/:branchId/warehouses
 */
export const getWarehouses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const warehouses = await stockService.getWarehouses(branchId)
    res.json({ branch_id: branchId, warehouses })
  } catch (error) {
    logger.error('Get warehouses error:', error)
    res.status(500).json({ error: 'Failed to get warehouses' })
  }
}

/**
 * Obtiene las líneas/familias disponibles en el catálogo de una sucursal
 * GET /api/stock/:branchId/lines
 */
export const getLines = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const lines = await stockService.getLines(branchId)
    res.json({ branch_id: branchId, lines })
  } catch (error) {
    logger.error('Get lines error:', error)
    res.status(500).json({ error: 'Failed to get lines' })
  }
}

/**
 * Obtiene las existencias de un artículo en TODOS los almacenes de una sucursal
 * GET /api/stock/:branchId/item/:itemCode/warehouses
 */
export const getItemWarehousesStock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const itemCode = req.params.itemCode

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const result = await stockService.getItemWarehousesStock(branchId, itemCode)

    if (!result) {
      res.status(404).json({ error: 'Item not found' })
      return
    }

    res.json(result)
  } catch (error) {
    logger.error('Get item warehouses stock error:', error)
    res.status(500).json({ error: 'Failed to get item warehouses stock' })
  }
}

/**
 * Obtiene los códigos de artículos de una sucursal (opcionalmente filtrado por línea)
 * GET /api/stock/:branchId/item-codes?linea=xxx
 */
export const getItemCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId)
    const linea = req.query.linea as string | undefined

    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' })
      return
    }

    const itemCodes = await stockService.getItemCodes(branchId, linea)
    res.json({ branch_id: branchId, item_codes: itemCodes })
  } catch (error) {
    logger.error('Get item codes error:', error)
    res.status(500).json({ error: 'Failed to get item codes' })
  }
}

export default {
  getStock,
  getBatchStock,
  getStockAllBranches,
  compareStock,
  getItemInfo,
  searchItems,
  invalidateCache,
  getWarehouses,
  getLines,
  getItemCodes,
  getItemWarehousesStock
}
