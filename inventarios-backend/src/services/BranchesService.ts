import { getLocalPool, BranchDbConfig } from '../config/database'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { ConnectionManager } from '../connections/ConnectionManager'

export class BranchesService {
  private pool = getLocalPool()

  /**
   * Obtiene todas las sucursales directamente de la DB
   */
  async getAllFromDb(): Promise<any[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT id, code, name, db_host, db_port, db_user, db_password, db_database, status FROM branches ORDER BY name ASC'
    )
    return rows
  }

  /**
   * Crea una nueva sucursal
   */
  async create(data: Partial<BranchDbConfig>): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO branches (code, name, db_host, db_port, db_user, db_password, db_database, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.code,
        data.name,
        data.host,
        data.port || 3306,
        data.user,
        data.password,
        data.database,
        'active'
      ]
    )

    const newId = result.insertId

    // Actualizar ConnectionManager dinámicamente
    const cm = ConnectionManager.getInstance()
    await cm.addBranch({
      id: newId,
      code: data.code!,
      name: data.name!,
      host: data.host!,
      port: data.port || 3306,
      user: data.user!,
      password: data.password!,
      database: data.database!
    })

    return newId
  }

  /**
   * Actualiza una sucursal existente
   */
  async update(id: number, data: Partial<BranchDbConfig>): Promise<void> {
    const fields: string[] = []
    const params: any[] = []

    if (data.code) { fields.push('code = ?'); params.push(data.code) }
    if (data.name) { fields.push('name = ?'); params.push(data.name) }
    if (data.host) { fields.push('db_host = ?'); params.push(data.host) }
    if (data.port) { fields.push('db_port = ?'); params.push(data.port) }
    if (data.user) { fields.push('db_user = ?'); params.push(data.user) }
    if (data.password) { fields.push('db_password = ?'); params.push(data.password) }
    if (data.database) { fields.push('db_database = ?'); params.push(data.database) }

    if (fields.length === 0) return

    params.push(id)
    await this.pool.execute(
      `UPDATE branches SET ${fields.join(', ')} WHERE id = ?`,
      params
    )

    // Recargar la sucursal en el ConnectionManager
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT id, code, name, db_host as host, db_port as port, db_user as user, db_password as password, db_database as \`database\` FROM branches WHERE id = ?',
      [id]
    )

    if (rows.length > 0) {
      const config = rows[0] as BranchDbConfig
      const cm = ConnectionManager.getInstance()
      await cm.addBranch(config)
    }
  }

  /**
   * Elimina una sucursal
   */
  async delete(id: number): Promise<void> {
    await this.pool.execute('DELETE FROM branches WHERE id = ?', [id])

    // Eliminar del ConnectionManager
    const cm = ConnectionManager.getInstance()
    await cm.removeBranch(id)
  }
}

export const branchesService = new BranchesService()
