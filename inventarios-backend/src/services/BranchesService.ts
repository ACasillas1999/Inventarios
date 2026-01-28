import { getLocalPool } from '../config/database'
import { logger } from '../utils/logger'
import { Branch } from '../types'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { BranchDbConfig } from '../config/database'

/**
 * BranchesService - Servicio para gestionar sucursales en la base de datos local
 */
export class BranchesService {
  private pool = getLocalPool()

  /**
   * Obtiene todas las sucursales de la base de datos local
   */
  async getAllBranches(): Promise<Branch[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM branches ORDER BY code'
    )
    return rows as Branch[]
  }

  /**
   * Obtiene una sucursal por ID
   */
  async getBranchById(id: number): Promise<Branch | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM branches WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return null
    }

    return rows[0] as Branch
  }

  /**
   * Obtiene una sucursal por código
   */
  async getBranchByCode(code: string): Promise<Branch | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM branches WHERE code = ?',
      [code]
    )

    if (rows.length === 0) {
      return null
    }

    return rows[0] as Branch
  }

  /**
   * Crea una nueva sucursal
   */
  async createBranch(data: {
    code: string
    name: string
    db_host: string
    db_port: number
    db_user: string
    db_password: string
    db_database: string
    status?: 'active' | 'inactive'
  }): Promise<Branch> {
    const query = `
      INSERT INTO branches (
        code, name, db_host, db_port, db_user, db_password, db_database, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

    const [result] = await this.pool.execute<ResultSetHeader>(query, [
      data.code,
      data.name,
      data.db_host,
      data.db_port,
      data.db_user,
      data.db_password,
      data.db_password, // Idealmente encriptado
      data.db_database,
      data.status || 'active'
    ])

    const branch = await this.getBranchById(result.insertId)
    if (!branch) {
      throw new Error('Failed to create branch')
    }

    logger.info(`Branch created: ${data.code} - ${data.name}`)
    return branch
  }

  /**
   * Actualiza una sucursal
   */
  async updateBranch(
    id: number,
    data: Partial<{
      code: string
      name: string
      db_host: string
      db_port: number
      db_user: string
      db_password: string
      db_database: string
      status: 'active' | 'inactive' | 'error'
    }>
  ): Promise<Branch> {
    const updates: string[] = []
    const params: any[] = []

    if (data.code !== undefined) {
      updates.push('code = ?')
      params.push(data.code)
    }

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)
    }

    if (data.db_host !== undefined) {
      updates.push('db_host = ?')
      params.push(data.db_host)
    }

    if (data.db_port !== undefined) {
      updates.push('db_port = ?')
      params.push(data.db_port)
    }

    if (data.db_user !== undefined) {
      updates.push('db_user = ?')
      params.push(data.db_user)
    }

    if (data.db_password !== undefined) {
      updates.push('db_password = ?')
      params.push(data.db_password)
    }

    if (data.db_database !== undefined) {
      updates.push('db_database = ?')
      params.push(data.db_database)
    }

    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    params.push(id)

    const query = `UPDATE branches SET ${updates.join(', ')} WHERE id = ?`
    await this.pool.execute(query, params)

    const branch = await this.getBranchById(id)
    if (!branch) {
      throw new Error('Branch not found after update')
    }

    logger.info(`Branch ${id} updated`)
    return branch
  }

  /**
   * Actualiza el estado de conexión de una sucursal
   */
  async updateConnectionStatus(
    id: number,
    status: 'active' | 'inactive' | 'error',
    connectionStatus: string,
    errorMessage?: string
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE branches
       SET status = ?, connection_status = ?, last_connection_check = NOW()
       WHERE id = ?`,
      [status, connectionStatus, id]
    )

    logger.debug(`Branch ${id} connection status updated: ${connectionStatus}`)
  }

  /**
   * Elimina una sucursal
   */
  async deleteBranch(id: number): Promise<void> {
    await this.pool.execute('DELETE FROM branches WHERE id = ?', [id])
    logger.info(`Branch ${id} deleted`)
  }

  /**
   * Convierte las sucursales de la BD a formato BranchDbConfig
   * Para usar con ConnectionManager
   */
  async getBranchesAsConfig(): Promise<BranchDbConfig[]> {
    const branches = await this.getAllBranches()

    return branches
      .filter((branch) => branch.status === 'active')
      .map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        host: branch.db_host,
        port: branch.db_port,
        user: branch.db_user,
        password: branch.db_password,
        database: branch.db_database,
        poolMax: 5
      }))
  }

  /**
   * Prueba la conexión a una sucursal
   */
  async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const branch = await this.getBranchById(id)
      if (!branch) {
        return { success: false, message: 'Branch not found' }
      }

      const mysql = require('mysql2/promise')
      const connection = await mysql.createConnection({
        host: branch.db_host,
        port: branch.db_port,
        user: branch.db_user,
        password: branch.db_password,
        database: branch.db_database,
        connectTimeout: 5000
      })

      await connection.ping()
      await connection.end()

      await this.updateConnectionStatus(id, 'active', 'connected')

      return { success: true, message: 'Connection successful' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateConnectionStatus(id, 'error', 'error', errorMessage)

      return { success: false, message: errorMessage }
    }
  }
}

export default BranchesService
