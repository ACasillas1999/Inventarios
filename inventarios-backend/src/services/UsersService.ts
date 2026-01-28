import { getLocalPool } from '../config/database'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { UserResponse } from '../types'
import bcrypt from 'bcryptjs'

export interface CreateUserData {
  name: string
  email: string
  password: string
  role_id?: number
  branch_id?: number
  branch_ids?: number[]
}

export class UsersService {
  private pool = getLocalPool()

  async getAll(): Promise<Array<Pick<UserResponse, 'id' | 'name' | 'email' | 'role_id' | 'status'> & { role_name: string }>> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.role_id, u.status, r.display_name as role_name 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.name ASC`
    )
    return rows as any
  }

  async create(data: CreateUserData): Promise<UserResponse> {
    const connection = await this.pool.getConnection()

    try {
      await connection.beginTransaction()

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10)

      // Insert user
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password, role_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
        [data.name, data.email, hashedPassword, data.role_id || 1]
      )

      const userId = result.insertId

      // If branch_ids provided, insert into user_branches
      if (data.branch_ids && data.branch_ids.length > 0) {
        const values = data.branch_ids.map(branchId => [userId, branchId])
        await connection.query(
          `INSERT INTO user_branches (user_id, branch_id) VALUES ?`,
          [values]
        )
      }
      // If single branch_id provided (legacy support)
      else if (data.branch_id) {
        await connection.execute(
          `INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)`,
          [userId, data.branch_id]
        )
      }

      await connection.commit()

      // Fetch and return created user
      const [users] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, name, email, role_id, status, created_at, updated_at, last_login
         FROM users WHERE id = ?`,
        [userId]
      )

      return users[0] as UserResponse
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async updateStatus(userId: number, status: string): Promise<void> {
    await this.pool.execute(
      `UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, userId]
    )
  }

  async changePassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await this.pool.execute(
      `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashedPassword, userId]
    )
  }
}

export default UsersService
