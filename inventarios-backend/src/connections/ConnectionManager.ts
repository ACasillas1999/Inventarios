import mysql from 'mysql2/promise'
import { BranchDbConfig } from '../config/database'
import { logger } from '../utils/logger'

interface BranchPool {
  config: BranchDbConfig
  pool: mysql.Pool
  status: 'connected' | 'disconnected' | 'error'
  lastCheck: Date
  errorMessage?: string
}

/**
 * ConnectionManager - Gestor de conexiones a múltiples bases de datos
 * Mantiene pools de conexiones para cada sucursal y monitorea su estado
 */
export class ConnectionManager {
  private static instance: ConnectionManager
  private branchPools: Map<number, BranchPool> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null

  private constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager()
    }
    return ConnectionManager.instance
  }

  /**
   * Inicializa las conexiones a todas las sucursales
   */
  public async initializeBranches(branches: BranchDbConfig[]): Promise<void> {
    logger.info(`Initializing ${branches.length} branch connections...`)

    for (const branch of branches) {
      try {
        await this.addBranch(branch)
      } catch (error) {
        logger.error(`Failed to initialize branch ${branch.code}:`, error)
      }
    }

    // Iniciar monitoreo de salud cada 30 segundos
    this.startHealthCheck()
    logger.info('Branch connections initialized')
  }

  /**
   * Agrega una nueva conexión de sucursal
   */
  public async addBranch(config: BranchDbConfig): Promise<void> {
    try {
      const poolConfig = {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: config.poolMax || 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        charset: 'utf8mb4',
        // Mantener timezone local para que fechas (si se consultan) no queden desfasadas
        timezone: 'local'
      }

      const pool = mysql.createPool(poolConfig)

      // Probar la conexión
      const connection = await pool.getConnection()
      await connection.ping()
      connection.release()

      this.branchPools.set(config.id, {
        config,
        pool,
        status: 'connected',
        lastCheck: new Date()
      })

      logger.info(`Branch ${config.code} (${config.name}) connected successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Crear pool aunque falle para reintentarlo después
      const pool = mysql.createPool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: config.poolMax || 5,
        queueLimit: 0
      })

      this.branchPools.set(config.id, {
        config,
        pool,
        status: 'error',
        lastCheck: new Date(),
        errorMessage
      })

      logger.error(`Branch ${config.code} connection failed: ${errorMessage}`)
    }
  }

  /**
   * Obtiene el pool de una sucursal por ID
   */
  public getPool(branchId: number): mysql.Pool | null {
    const branchPool = this.branchPools.get(branchId)
    if (!branchPool) {
      logger.warn(`Branch pool ${branchId} not found`)
      return null
    }
    if (branchPool.status === 'error') {
      logger.warn(`Branch ${branchPool.config.code} is in error state`)
      return null
    }
    return branchPool.pool
  }

  /**
   * Obtiene el pool de una sucursal por código
   */
  public getPoolByCode(branchCode: string): mysql.Pool | null {
    for (const [, branchPool] of this.branchPools) {
      if (branchPool.config.code === branchCode) {
        if (branchPool.status === 'error') {
          logger.warn(`Branch ${branchCode} is in error state`)
          return null
        }
        return branchPool.pool
      }
    }
    logger.warn(`Branch pool ${branchCode} not found`)
    return null
  }

  /**
   * Ejecuta una consulta en una sucursal específica
   */
  public async executeQuery<T = any>(
    branchId: number,
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    const pool = this.getPool(branchId)
    if (!pool) {
      throw new Error(`Cannot execute query: branch ${branchId} pool not available`)
    }

    try {
      const safeParams =
        params === undefined || params === null
          ? []
          : Array.isArray(params)
            ? params
            : [params]

      const [rows] = await pool.query(query, safeParams)
      return rows as T[]
    } catch (error) {
      logger.error(`Query error on branch ${branchId}:`, error)
      throw error
    }
  }

  /**
   * Ejecuta una consulta en todas las sucursales en paralelo
   */
  public async executeQueryOnAllBranches<T = any>(
    query: string,
    params: any[] = []
  ): Promise<Map<number, T[]>> {
    const results = new Map<number, T[]>()
    const promises: Promise<void>[] = []

    for (const [branchId, branchPool] of this.branchPools) {
      if (branchPool.status === 'connected') {
        promises.push(
          this.executeQuery<T>(branchId, query, params)
            .then((rows) => {
              results.set(branchId, rows)
            })
            .catch((error) => {
              logger.error(`Query failed on branch ${branchId}:`, error)
              results.set(branchId, [])
            })
        )
      }
    }

    await Promise.all(promises)
    return results
  }

  /**
   * Verifica el estado de salud de una sucursal
   */
  public async checkBranchHealth(branchId: number): Promise<boolean> {
    const branchPool = this.branchPools.get(branchId)
    if (!branchPool) return false

    try {
      const connection = await branchPool.pool.getConnection()
      await connection.ping()
      connection.release()

      branchPool.status = 'connected'
      branchPool.lastCheck = new Date()
      branchPool.errorMessage = undefined

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      branchPool.status = 'error'
      branchPool.lastCheck = new Date()
      branchPool.errorMessage = errorMessage

      logger.error(`Health check failed for branch ${branchPool.config.code}: ${errorMessage}`)
      return false
    }
  }

  /**
   * Verifica el estado de todas las sucursales
   */
  public async checkAllBranchesHealth(): Promise<Map<number, boolean>> {
    const healthStatus = new Map<number, boolean>()
    const promises: Promise<void>[] = []

    for (const branchId of this.branchPools.keys()) {
      promises.push(
        this.checkBranchHealth(branchId).then((isHealthy) => {
          healthStatus.set(branchId, isHealthy)
        })
      )
    }

    await Promise.all(promises)
    return healthStatus
  }

  /**
   * Obtiene el estado de todas las sucursales
   */
  public getBranchesStatus(): Array<{
    id: number
    code: string
    name: string
    status: string
    lastCheck: Date
    errorMessage?: string
  }> {
    const statuses: Array<{
      id: number
      code: string
      name: string
      status: string
      lastCheck: Date
      errorMessage?: string
    }> = []

    for (const [, branchPool] of this.branchPools) {
      statuses.push({
        id: branchPool.config.id,
        code: branchPool.config.code,
        name: branchPool.config.name,
        status: branchPool.status,
        lastCheck: branchPool.lastCheck,
        errorMessage: branchPool.errorMessage
      })
    }

    return statuses
  }

  /**
   * Inicia el monitoreo periódico de salud
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // Verificar cada 30 segundos
    this.healthCheckInterval = setInterval(async () => {
      logger.debug('Running health check on all branches...')
      await this.checkAllBranchesHealth()
    }, 30000)
  }

  /**
   * Detiene el monitoreo de salud
   */
  public stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Cierra todas las conexiones
   */
  public async closeAll(): Promise<void> {
    this.stopHealthCheck()

    const promises: Promise<void>[] = []
    for (const [, branchPool] of this.branchPools) {
      promises.push(
        branchPool.pool.end().catch((error) => {
          logger.error(`Error closing pool for ${branchPool.config.code}:`, error)
        })
      )
    }

    await Promise.all(promises)
    this.branchPools.clear()
    logger.info('All branch connections closed')
  }

  /**
   * Obtiene la cantidad de sucursales conectadas
   */
  public getConnectedBranchesCount(): number {
    let count = 0
    for (const [, branchPool] of this.branchPools) {
      if (branchPool.status === 'connected') {
        count++
      }
    }
    return count
  }

  /**
   * Obtiene todas las configuraciones de sucursales
   */
  public getAllBranchConfigs(): BranchDbConfig[] {
    const configs: BranchDbConfig[] = []
    for (const [, branchPool] of this.branchPools) {
      configs.push(branchPool.config)
    }
    return configs
  }
}

export default ConnectionManager
