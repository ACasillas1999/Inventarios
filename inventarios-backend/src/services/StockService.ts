import { ConnectionManager } from '../connections/ConnectionManager'
import { CacheService } from '../utils/cache'
import { logger } from '../utils/logger'
import { ItemFromBranch, StockResponse } from '../types'

/**
 * StockService - Servicio para consultar existencias en las sucursales
 * Utiliza caché para optimizar las consultas repetidas
 */
export class StockService {
  private connectionManager: ConnectionManager
  private cacheService: CacheService

  constructor() {
    this.connectionManager = ConnectionManager.getInstance()
    this.cacheService = CacheService.getInstance()
  }

  /**
   * Obtiene la existencia de un artículo en una sucursal
   * Intenta primero desde caché, luego consulta la BD
   */
  async getStock(branchId: number, itemCode: string): Promise<number> {
    // Intentar obtener desde caché
    const cachedStock = this.cacheService.getStock(branchId, itemCode)
    if (cachedStock !== undefined) {
      return cachedStock
    }

    // Consultar base de datos
    const stock = await this.queryStockFromDatabase(branchId, itemCode)

    // Guardar en caché
    this.cacheService.setStock(branchId, itemCode, stock)

    return stock
  }

  /**
   * Consulta la existencia directamente de la base de datos
   * Adaptado al esquema real: Tabla articuloalm con columnas Clave_Articulo y Existencia_Fisica
   * IMPORTANTE: Almacen = 1 representa la sucursal principal; otros números son bodegas
   */
  private async queryStockFromDatabase(branchId: number, itemCode: string): Promise<number> {
    try {
      // Consulta adaptada al esquema real de la base de datos
      // Filtrar por Almacen = 1 (sucursal principal, no bodegas)
      const query = `
        SELECT Existencia_Fisica as stock
        FROM articuloalm
        WHERE Clave_Articulo = ? AND Almacen = 1
        LIMIT 1
      `

      const results = await this.connectionManager.executeQuery<{ stock: number }>(
        branchId,
        query,
        [itemCode]
      )

      if (results.length === 0) {
        logger.warn(`Item ${itemCode} not found in branch ${branchId}`)
        return 0
      }

      return results[0].stock || 0
    } catch (error: any) {
      // Si la tabla no existe, retornar 0
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articuloalm does not exist in branch ${branchId}`)
        return 0
      }
      // Si la sucursal no está disponible o hay error de conexión
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return 0
      }
      logger.error(`Error querying stock for ${itemCode} in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Obtiene las existencias de múltiples artículos en una sucursal
   * Optimizado para consultas en paralelo
   */
  async getBatchStock(branchId: number, itemCodes: string[]): Promise<Map<string, number>> {
    const stocks = new Map<string, number>()

    // Separar artículos en caché y no en caché
    const cachedStocks = this.cacheService.getMultipleStocks(branchId, itemCodes)
    const itemsToQuery: string[] = []

    for (const [itemCode, stock] of cachedStocks) {
      if (stock !== undefined) {
        stocks.set(itemCode, stock)
      } else {
        itemsToQuery.push(itemCode)
      }
    }

    // Si todos están en caché, retornar
    if (itemsToQuery.length === 0) {
      return stocks
    }

    // Consultar los que no están en caché
    try {
      // Consulta adaptada al esquema real
      // Filtrar por Almacen = 1 (sucursal principal, no bodegas)
      const placeholders = itemsToQuery.map(() => '?').join(',')
      const query = `
        SELECT Clave_Articulo as item_code, Existencia_Fisica as stock
        FROM articuloalm
        WHERE Clave_Articulo IN (${placeholders}) AND Almacen = 1
      `

      const results = await this.connectionManager.executeQuery<{
        item_code: string
        stock: number
      }>(branchId, query, itemsToQuery)

      // Procesar resultados y guardar en caché
      const queriedStocks = new Map<string, number>()
      for (const row of results) {
        const stock = row.stock || 0
        stocks.set(row.item_code, stock)
        queriedStocks.set(row.item_code, stock)
      }

      // Guardar en caché
      this.cacheService.setMultipleStocks(branchId, queriedStocks)

      // Agregar 0 para artículos no encontrados
      for (const itemCode of itemsToQuery) {
        if (!stocks.has(itemCode)) {
          stocks.set(itemCode, 0)
          this.cacheService.setStock(branchId, itemCode, 0)
        }
      }
    } catch (error) {
      logger.error(`Error querying batch stock in branch ${branchId}:`, error)
      throw error
    }

    return stocks
  }

  /**
   * Obtiene las existencias de un artículo en todas las sucursales
   * Ejecuta consultas en paralelo
   */
  async getStockAllBranches(itemCode: string): Promise<StockResponse[]> {
    const branches = this.connectionManager.getAllBranchConfigs()
    const results: StockResponse[] = []

    const promises = branches.map(async (branch) => {
      try {
        const stock = await this.getStock(branch.id, itemCode)
        return {
          branch_id: branch.id,
          branch_code: branch.code,
          item_code: itemCode,
          stock,
          cached: this.cacheService.getStock(branch.id, itemCode) !== undefined
        }
      } catch (error) {
        logger.error(`Error getting stock for ${itemCode} in branch ${branch.code}:`, error)
        return {
          branch_id: branch.id,
          branch_code: branch.code,
          item_code: itemCode,
          stock: 0,
          cached: false
        }
      }
    })

    const resolved = await Promise.all(promises)
    results.push(...resolved)

    return results
  }

  /**
   * Obtiene información completa de un artículo de una sucursal
   */
  async getItemInfo(branchId: number, itemCode: string): Promise<ItemFromBranch | null> {
    try {
      // Intentar desde caché
      const cachedItem = this.cacheService.getItem<ItemFromBranch>(itemCode)
      if (cachedItem) {
        return cachedItem
      }

      // Consulta adaptada al esquema real (catálogo en articulo + existencia en articuloalm)
      // IMPORTANTE: Linea se extrae de los primeros 5 caracteres de Clave_Articulo
      // Filtrar por Almacen = 1 (sucursal principal, no bodegas)
      const query = `
        SELECT
          a.Clave_Articulo as codigo,
          a.Descripcion as descripcion,
          LEFT(a.Clave_Articulo, 5) as linea,
          a.Unidad_Medida as unidad,
          alm.Almacen as almacen,
          IFNULL(alm.Existencia_Fisica, 0) as existencia,
          IFNULL(alm.Existencia_Fisica, 0) as existencia_fisica,
          alm.Rack as rack,
          COALESCE(alm.Inventario_Minimo, a.Inventario_Minimo) as Inventario_Minimo,
          COALESCE(alm.Inventario_Maximo, a.Inventario_Maximo) as Inventario_Maximo,
          COALESCE(alm.Punto_Reorden, a.Punto_Reorden) as Punto_Reorden,
          COALESCE(alm.Existencia_Teorica, a.Existencia_Teorica, 0) as Existencia_Teorica,
          COALESCE(alm.Inventario_Minimo, a.Inventario_Minimo) as inventario_minimo,
          COALESCE(alm.Inventario_Maximo, a.Inventario_Maximo) as inventario_maximo,
          COALESCE(alm.Punto_Reorden, a.Punto_Reorden) as punto_reorden,
          COALESCE(alm.Existencia_Teorica, a.Existencia_Teorica, 0) as existencia_teorica,
          COALESCE(alm.Costo_Promedio, a.Costo_Promedio) as Costo_Promedio,
          COALESCE(alm.Costo_Promedio_Ant, a.Costo_Promedio_Ant) as Costo_Promedio_Ant,
          COALESCE(alm.Costo_Ult_Compra, a.Costo_Ult_Compra) as Costo_Ult_Compra,
          COALESCE(alm.Fecha_Ult_Compra, a.Fecha_Ult_Compra) as Fecha_Ult_Compra,
          COALESCE(alm.Costo_Compra_Ant, a.Costo_Compra_Ant) as Costo_Compra_Ant,
          COALESCE(alm.Fecha_Compra_Ant, a.Fecha_Compra_Ant) as Fecha_Compra_Ant,
          COALESCE(alm.Costo_Promedio, a.Costo_Promedio) as costo_promedio,
          COALESCE(alm.Costo_Promedio_Ant, a.Costo_Promedio_Ant) as costo_promedio_ant,
          COALESCE(alm.Costo_Ult_Compra, a.Costo_Ult_Compra) as costo_ultima_compra,
          COALESCE(alm.Fecha_Ult_Compra, a.Fecha_Ult_Compra) as fecha_ult_compra,
          COALESCE(alm.Costo_Compra_Ant, a.Costo_Compra_Ant) as costo_compra_ant,
          COALESCE(alm.Fecha_Compra_Ant, a.Fecha_Compra_Ant) as fecha_compra_ant,
          COALESCE(alm.PendientedeEntrega, 0) as pendiente_entrega
        FROM articulo a
        LEFT JOIN articuloalm alm ON alm.Clave_Articulo = a.Clave_Articulo AND alm.Almacen = 1
        WHERE a.Clave_Articulo = ?
        LIMIT 1
      `

      const results = await this.connectionManager.executeQuery<ItemFromBranch>(
        branchId,
        query,
        [itemCode]
      )

      if (results.length === 0) {
        return null
      }

      const item = results[0]

      // Guardar en caché
      this.cacheService.setItem(itemCode, item)

      return item
    } catch (error: any) {
      // Si las tablas no existen, retornar null
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articulo/articuloalm does not exist in branch ${branchId}`)
        return null
      }
      // Si la sucursal no está disponible o hay error de conexión
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return null
      }
      logger.error(`Error getting item info for ${itemCode} in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Busca artículos en una sucursal con filtros
   */
  async searchItems(
    branchId: number,
    search?: string,
    linea?: string,
    limit: number = 50,
    offset: number = 0,
    almacen: number = 1
  ): Promise<ItemFromBranch[]> {
    try {
      // Generar clave de caché incluyendo el almacén
      const cacheKey = `v2_${search || 'all'}_${linea || 'all'}_${almacen}_${limit}_${offset}`
      const cachedItems = this.cacheService.getBranchItems<ItemFromBranch>(branchId, cacheKey)

      if (cachedItems) {
        return cachedItems
      }

      // Estrategia optimizada sin JOIN: primero obtener artículos, luego buscar existencias
      // Esto es mucho más rápido cuando articuloalm no tiene índice en Clave_Articulo
      // IMPORTANTE: Linea se extrae de los primeros 5 caracteres de Clave_Articulo
      let query = `
        SELECT
          Clave_Articulo as codigo,
          Descripcion as descripcion,
          LEFT(Clave_Articulo, 5) as linea,
          Unidad_Medida as unidad,
          Inventario_Minimo as inventario_minimo,
          Inventario_Maximo as inventario_maximo,
          Existencia_Teorica as existencia_teorica,
          Punto_Reorden as punto_reorden,
          Costo_Promedio as costo_promedio,
          Costo_Ult_Compra as costo_ultima_compra,
          Fecha_Ult_Compra as fecha_ult_compra
        FROM articulo
        WHERE 1=1
      `
      const params: any[] = []

      if (search) {
        query += ` AND (Clave_Articulo LIKE ? OR Descripcion LIKE ?)`
        params.push(`%${search}%`, `%${search}%`)
      }

      if (linea === '__EMPTY__') {
        query += ` AND (LEFT(Clave_Articulo, 5) IS NULL OR LEFT(Clave_Articulo, 5) = '')`
      } else if (linea) {
        query += ` AND LEFT(Clave_Articulo, 5) = ?`
        params.push(linea)
      }

      query += ` ORDER BY Clave_Articulo LIMIT ${parseInt(String(limit))} OFFSET ${parseInt(String(offset))}`

      const articles = await this.connectionManager.executeQuery<any>(branchId, query, params)

      const itemCodes = articles.map((a: any) => a.codigo).filter(Boolean)
      const stockByCode = new Map<string, any>()

      if (itemCodes.length > 0) {
        try {
          const placeholders = itemCodes.map(() => '?').join(',')
          // Filtrar por el almacén especificado (por defecto 1 = sucursal principal)
          const stockQuery = `
            SELECT
              Clave_Articulo as codigo,
              Almacen as almacen,
              Existencia_Fisica as existencia_fisica,
              Existencia_Teorica as existencia_teorica,
              Inventario_Minimo as inventario_minimo,
              Inventario_Maximo as inventario_maximo,
              Punto_Reorden as punto_reorden,
              Rack as rack,
              Costo_Promedio as costo_promedio,
              Costo_Promedio_Ant as costo_promedio_ant,
              Costo_Ult_Compra as costo_ultima_compra,
              Fecha_Ult_Compra as fecha_ult_compra,
              Costo_Compra_Ant as costo_compra_ant,
              Fecha_Compra_Ant as fecha_compra_ant,
              PendientedeEntrega as pendiente_entrega
            FROM articuloalm
            WHERE Clave_Articulo IN (${placeholders}) AND Almacen = ?
          `

          const stockRows = await this.connectionManager.executeQuery<any>(
            branchId,
            stockQuery,
            [...itemCodes, almacen]
          )

          for (const row of stockRows) {
            stockByCode.set(row.codigo, row)
          }
        } catch (error: any) {
          if (error.code === 'ER_NO_SUCH_TABLE') {
            logger.warn(`Table articuloalm does not exist in branch ${branchId}`)
          } else if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
            logger.warn(`Branch ${branchId} is not available`)
          } else {
            logger.warn(
              `Could not load stock from articuloalm for branch ${branchId}: ${error.message || error}`
            )
          }
        }
      }

      const results: ItemFromBranch[] = articles.map((article: any) => {
        const stock = stockByCode.get(article.codigo)

        const existenciaFisica = Number(stock?.existencia_fisica ?? 0) || 0
        const existenciaTeorica =
          Number(stock?.existencia_teorica ?? article.existencia_teorica ?? 0) || 0

        return {
          codigo: article.codigo,
          descripcion: article.descripcion,
          linea: article.linea,
          unidad: article.unidad,
          almacen: stock?.almacen,
          existencia: existenciaFisica,
          existencia_fisica: existenciaFisica,
          existencia_teorica: existenciaTeorica,
          Existencia_Teorica: existenciaTeorica,
          rack: stock?.rack,
          Rack: stock?.rack,
          inventario_minimo: stock?.inventario_minimo ?? article.inventario_minimo,
          inventario_maximo: stock?.inventario_maximo ?? article.inventario_maximo,
          Inventario_Minimo: stock?.inventario_minimo ?? article.inventario_minimo,
          Inventario_Maximo: stock?.inventario_maximo ?? article.inventario_maximo,
          punto_reorden: stock?.punto_reorden ?? article.punto_reorden,
          Punto_Reorden: stock?.punto_reorden ?? article.punto_reorden,
          costo_promedio: stock?.costo_promedio ?? article.costo_promedio,
          costo_promedio_ant: stock?.costo_promedio_ant,
          costo_ultima_compra: stock?.costo_ultima_compra ?? article.costo_ultima_compra,
          fecha_ult_compra: stock?.fecha_ult_compra ?? article.fecha_ult_compra,
          costo_compra_ant: stock?.costo_compra_ant,
          fecha_compra_ant: stock?.fecha_compra_ant,
          pendiente_entrega: Number(stock?.pendiente_entrega ?? 0) || 0
        }
      })

      // Guardar en caché
      this.cacheService.setBranchItems(branchId, results, cacheKey)

      return results
    } catch (error: any) {
      // Si las tablas no existen, retornar array vacío en lugar de error
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articulo/articuloalm does not exist in branch ${branchId}`)
        return []
      }
      // Si la sucursal no está disponible o hay error de conexión
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return []
      }
      logger.error(`Error searching items in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Invalida el caché de un artículo en una sucursal
   */
  invalidateCache(branchId: number, itemCode?: string): void {
    if (itemCode) {
      this.cacheService.invalidateStock(branchId, itemCode)
    } else {
      this.cacheService.invalidateBranch(branchId)
    }
  }

  /**
   * Sincroniza las existencias de múltiples artículos
   * Útil para actualizar el caché
   */
  async syncStocks(branchId: number, itemCodes: string[]): Promise<void> {
    logger.info(`Syncing ${itemCodes.length} items for branch ${branchId}`)

    // Invalidar caché existente
    for (const itemCode of itemCodes) {
      this.cacheService.invalidateStock(branchId, itemCode)
    }

    // Recargar desde base de datos
    await this.getBatchStock(branchId, itemCodes)

    logger.info(`Sync completed for branch ${branchId}`)
  }
  /**
   * Obtiene los almacenes disponibles en una sucursal
   */
  async getWarehouses(branchId: number): Promise<Array<{ almacen: number; nombre?: string }>> {
    try {
      const query = `
        SELECT DISTINCT Almacen as almacen
        FROM articuloalm
        WHERE Almacen IS NOT NULL
        ORDER BY Almacen ASC
      `

      const results = await this.connectionManager.executeQuery<{ almacen: number }>(
        branchId,
        query,
        []
      )

      // Devolver con nombres descriptivos
      return results.map((row) => ({
        almacen: row.almacen,
        nombre: row.almacen === 1 ? 'Sucursal principal' : `Bodega ${row.almacen}`
      }))
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articuloalm does not exist in branch ${branchId}`)
        return []
      }
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return []
      }
      logger.error(`Error getting warehouses in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Obtiene las líneas (familias) distintas del catálogo de una sucursal
   * IMPORTANTE: Las líneas se obtienen de los primeros 5 caracteres de Clave_Articulo
   */
  async getLines(branchId: number): Promise<string[]> {
    try {
      // Intentar obtener desde caché
      const cacheKey = 'all_lines'
      const cachedLines = this.cacheService.getBranchItems<string>(branchId, cacheKey)
      if (cachedLines) {
        return cachedLines
      }

      // Query optimizada: extrae los primeros 5 caracteres de Clave_Articulo como línea
      const query = `
        SELECT DISTINCT LEFT(Clave_Articulo, 5) as linea
        FROM articulo
        WHERE Clave_Articulo IS NOT NULL
          AND Clave_Articulo <> ''
          AND LENGTH(Clave_Articulo) >= 5
        ORDER BY linea ASC
        LIMIT 1000
      `

      const results = await this.connectionManager.executeQuery<{ linea: string }>(
        branchId,
        query,
        []
      )

      const lines = results.map((row) => row.linea).filter(Boolean)

      // Guardar en caché por 1 hora (las líneas no cambian frecuentemente)
      this.cacheService.setBranchItems(branchId, lines, cacheKey)

      return lines
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articulo does not exist in branch ${branchId}`)
        return []
      }
      // Si la sucursal no está disponible o hay error de conexión
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return []
      }
      logger.error(`Error getting lines in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Obtiene las existencias de un artículo en TODOS los almacenes de una sucursal
   * Incluye información del artículo y detalles de cada almacén
   */
  async getItemWarehousesStock(
    branchId: number,
    itemCode: string
  ): Promise<{
    item_code: string
    item_description: string
    item_line: string
    item_unit: string
    total_stock: number
    warehouses: Array<{
      warehouse_id: number
      warehouse_name: string
      stock: number
      rack: string | null
      avg_cost: number
      min_stock: number | null
      max_stock: number | null
      reorder_point: number | null
    }>
  } | null> {
    try {
      // Primero obtener información del artículo
      const itemQuery = `
        SELECT 
          Clave_Articulo as codigo,
          Descripcion as descripcion,
          LEFT(Clave_Articulo, 5) as linea,
          Unidad_Medida as unidad
        FROM articulo
        WHERE Clave_Articulo = ?
        LIMIT 1
      `

      const itemResults = await this.connectionManager.executeQuery<{
        codigo: string
        descripcion: string
        linea: string
        unidad: string
      }>(branchId, itemQuery, [itemCode])

      if (itemResults.length === 0) {
        logger.warn(`Item ${itemCode} not found in branch ${branchId}`)
        return null
      }

      const itemInfo = itemResults[0]

      // Luego obtener existencias en todos los almacenes
      const warehousesQuery = `
        SELECT 
          aa.Almacen as warehouse_id,
          alm.Nombre as warehouse_name,
          aa.Existencia_Fisica as stock,
          aa.Rack as rack,
          aa.Costo_Promedio as avg_cost,
          aa.Inventario_Minimo as min_stock,
          aa.Inventario_Maximo as max_stock,
          aa.Punto_Reorden as reorder_point
        FROM articuloalm aa
        INNER JOIN almacenes alm ON aa.Almacen = alm.Almacen
        WHERE aa.Clave_Articulo = ?
        ORDER BY aa.Almacen ASC
      `

      const warehousesResults = await this.connectionManager.executeQuery<{
        warehouse_id: number
        warehouse_name: string
        stock: number
        rack: string | null
        avg_cost: number
        min_stock: number | null
        max_stock: number | null
        reorder_point: number | null
      }>(branchId, warehousesQuery, [itemCode])

      // Calcular stock total
      const totalStock = warehousesResults.reduce((sum, wh) => sum + (wh.stock || 0), 0)

      return {
        item_code: itemInfo.codigo,
        item_description: itemInfo.descripcion,
        item_line: itemInfo.linea,
        item_unit: itemInfo.unidad,
        total_stock: totalStock,
        warehouses: warehousesResults.map((wh) => ({
          warehouse_id: wh.warehouse_id,
          warehouse_name: wh.warehouse_name,
          stock: wh.stock || 0,
          rack: wh.rack,
          avg_cost: wh.avg_cost || 0,
          min_stock: wh.min_stock,
          max_stock: wh.max_stock,
          reorder_point: wh.reorder_point
        }))
      }
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(
          `Table articulo/articuloalm/almacenes does not exist in branch ${branchId}`
        )
        return null
      }
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return null
      }
      logger.error(`Error getting item warehouses stock for ${itemCode} in branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Obtiene los códigos de artículos para una sucursal (opcionalmente filtrado por línea)
   * Útil para "seleccionar todos" sin paginación.
   * IMPORTANTE: Las líneas se filtran por los primeros 5 caracteres de Clave_Articulo
   */
  async getItemCodes(branchId: number, linea?: string): Promise<string[]> {
    try {
      let query = `
        SELECT Clave_Articulo as codigo
        FROM articulo
        WHERE 1=1
      `
      const params: any[] = []

      if (linea === '__EMPTY__') {
        query += ` AND (LEFT(Clave_Articulo, 5) IS NULL OR LEFT(Clave_Articulo, 5) = '')`
      } else if (linea) {
        query += ` AND LEFT(Clave_Articulo, 5) = ?`
        params.push(linea)
      }

      query += ` ORDER BY Clave_Articulo ASC`

      const results = await this.connectionManager.executeQuery<{ codigo: string }>(
        branchId,
        query,
        params
      )
      return results.map((r) => r.codigo).filter(Boolean)
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        logger.warn(`Table articulo does not exist in branch ${branchId}`)
        return []
      }
      if (error.message?.includes('pool not available') || error.code === 'ECONNREFUSED') {
        logger.warn(`Branch ${branchId} is not available`)
        return []
      }
      logger.error(`Error getting item codes in branch ${branchId}:`, error)
      throw error
    }
  }
}

export default StockService
