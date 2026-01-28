import NodeCache from 'node-cache'
import { logger } from './logger'
import { cacheConfig } from '../config/database'

/**
 * CacheService - Sistema de caché en memoria para optimizar consultas
 * a bases de datos de sucursales
 */
export class CacheService {
  private static instance: CacheService
  private cache: NodeCache

  private constructor() {
    this.cache = new NodeCache({
      stdTTL: cacheConfig.ttlStock,
      checkperiod: 60,
      useClones: false,
      deleteOnExpire: true
    })

    this.cache.on('expired', (key: string) => {
      logger.debug(`Cache key expired: ${key}`)
    })
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  /**
   * Genera una clave de caché para existencias
   */
  private getStockKey(branchId: number, itemCode: string): string {
    return `stock:${branchId}:${itemCode}`
  }

  /**
   * Genera una clave de caché para artículos
   */
  private getItemKey(itemCode: string): string {
    return `item:${itemCode}`
  }

  /**
   * Genera una clave de caché para artículos de sucursal
   */
  private getBranchItemsKey(branchId: number, filters?: string): string {
    return `branch_items:${branchId}:${filters || 'all'}`
  }

  /**
   * Obtiene el stock de un artículo desde caché
   */
  public getStock(branchId: number, itemCode: string): number | undefined {
    const key = this.getStockKey(branchId, itemCode)
    const value = this.cache.get<number>(key)
    if (value !== undefined) {
      logger.debug(`Cache hit: ${key}`)
    }
    return value
  }

  /**
   * Guarda el stock de un artículo en caché
   */
  public setStock(branchId: number, itemCode: string, stock: number, ttl?: number): void {
    const key = this.getStockKey(branchId, itemCode)
    const success = this.cache.set(key, stock, ttl || cacheConfig.ttlStock)
    if (success) {
      logger.debug(`Cache set: ${key} = ${stock}`)
    }
  }

  /**
   * Obtiene múltiples stocks desde caché
   */
  public getMultipleStocks(
    branchId: number,
    itemCodes: string[]
  ): Map<string, number | undefined> {
    const results = new Map<string, number | undefined>()
    for (const itemCode of itemCodes) {
      results.set(itemCode, this.getStock(branchId, itemCode))
    }
    return results
  }

  /**
   * Guarda múltiples stocks en caché
   */
  public setMultipleStocks(
    branchId: number,
    stocks: Map<string, number>,
    ttl?: number
  ): void {
    for (const [itemCode, stock] of stocks) {
      this.setStock(branchId, itemCode, stock, ttl)
    }
  }

  /**
   * Obtiene un artículo desde caché
   */
  public getItem<T = any>(itemCode: string): T | undefined {
    const key = this.getItemKey(itemCode)
    const value = this.cache.get<T>(key)
    if (value !== undefined) {
      logger.debug(`Cache hit: ${key}`)
    }
    return value
  }

  /**
   * Guarda un artículo en caché
   */
  public setItem<T = any>(itemCode: string, item: T, ttl?: number): void {
    const key = this.getItemKey(itemCode)
    const success = this.cache.set(key, item, ttl || cacheConfig.ttlItems)
    if (success) {
      logger.debug(`Cache set: ${key}`)
    }
  }

  /**
   * Obtiene artículos de una sucursal desde caché
   */
  public getBranchItems<T = any>(branchId: number, filters?: string): T[] | undefined {
    const key = this.getBranchItemsKey(branchId, filters)
    const value = this.cache.get<T[]>(key)
    if (value !== undefined) {
      logger.debug(`Cache hit: ${key}`)
    }
    return value
  }

  /**
   * Guarda artículos de una sucursal en caché
   */
  public setBranchItems<T = any>(
    branchId: number,
    items: T[],
    filters?: string,
    ttl?: number
  ): void {
    const key = this.getBranchItemsKey(branchId, filters)
    const success = this.cache.set(key, items, ttl || cacheConfig.ttlItems)
    if (success) {
      logger.debug(`Cache set: ${key} (${items.length} items)`)
    }
  }

  /**
   * Invalida el caché de stock de un artículo específico
   */
  public invalidateStock(branchId: number, itemCode: string): void {
    const key = this.getStockKey(branchId, itemCode)
    this.cache.del(key)
    logger.debug(`Cache invalidated: ${key}`)
  }

  /**
   * Invalida todo el caché de stock de una sucursal
   */
  public invalidateBranchStock(branchId: number): void {
    const pattern = `stock:${branchId}:`
    const keys = this.cache.keys().filter((key) => key.startsWith(pattern))
    this.cache.del(keys)
    logger.debug(`Cache invalidated: ${keys.length} keys for branch ${branchId}`)
  }

  /**
   * Invalida el caché de artículos de una sucursal
   */
  public invalidateBranchItems(branchId: number): void {
    const pattern = `branch_items:${branchId}:`
    const keys = this.cache.keys().filter((key) => key.startsWith(pattern))
    this.cache.del(keys)
    logger.debug(`Cache invalidated: ${keys.length} keys for branch ${branchId} items`)
  }

  /**
   * Invalida todo el caché de una sucursal
   */
  public invalidateBranch(branchId: number): void {
    this.invalidateBranchStock(branchId)
    this.invalidateBranchItems(branchId)
  }

  /**
   * Obtiene estadísticas del caché
   */
  public getStats(): NodeCache.Stats {
    return this.cache.getStats()
  }

  /**
   * Limpia todo el caché
   */
  public flushAll(): void {
    this.cache.flushAll()
    logger.info('Cache flushed')
  }

  /**
   * Obtiene una clave genérica del caché
   */
  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key)
  }

  /**
   * Guarda una clave genérica en el caché
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || cacheConfig.ttlConfig)
  }

  /**
   * Elimina una clave del caché
   */
  public delete(key: string): number {
    return this.cache.del(key)
  }

  /**
   * Verifica si una clave existe en caché
   */
  public has(key: string): boolean {
    return this.cache.has(key)
  }
}

export default CacheService
