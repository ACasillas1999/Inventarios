import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getLocalPool } from '../config/database'
import { generateToken } from '../middlewares/auth'
import { logger } from '../utils/logger'
import { RowDataPacket } from 'mysql2/promise'
import { User, UserResponse } from '../types'

/**
 * Login de usuario
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const pool = getLocalPool()

    // Buscar usuario
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.status = 'active'`,
      [email]
    )

    if (users.length === 0) {
      logger.warn(`Login attempt with invalid email: ${email}`)
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const user = users[0] as User & { role_name: string; permissions: any }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      logger.warn(`Login attempt with invalid password for user: ${email}`)
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Actualizar último login
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

    // Generar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role_id: user.role_id
    })

    // Obtener sucursales del usuario
    const [branches] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.code, b.name, b.status
       FROM branches b
       INNER JOIN user_branches ub ON b.id = ub.branch_id
       WHERE ub.user_id = ?`,
      [user.id]
    )

    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      branches: branches as any[]
    }

    logger.info(`User logged in: ${email}`)

    res.json({
      token,
      user: userResponse
    })
  } catch (error) {
    logger.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Obtiene el perfil del usuario autenticado
 */
export const getProfile = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const pool = getLocalPool()

    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    )

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = users[0] as User & { role_name: string; permissions: any }

    // Obtener sucursales del usuario
    const [branches] = await pool.execute<RowDataPacket[]>(
      `SELECT b.id, b.code, b.name, b.status
       FROM branches b
       INNER JOIN user_branches ub ON b.id = ub.branch_id
       WHERE ub.user_id = ?`,
      [userId]
    )

    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role_id: user.role_id,
      role_name: user.role_name,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      branches: branches as any[]
    }

    res.json(userResponse)
  } catch (error) {
    logger.error('Get profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Cambia la contraseña del usuario
 */
export const changePassword = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' })
      return
    }

    const pool = getLocalPool()

    // Obtener usuario
    const [users] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [
      userId
    ])

    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const user = users[0] as User

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' })
      return
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Actualizar contraseña
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId])

    logger.info(`Password changed for user ${userId}`)
    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    logger.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export default { login, getProfile, changePassword }
