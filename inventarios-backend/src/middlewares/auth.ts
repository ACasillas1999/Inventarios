import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this'

export interface AuthRequest extends Request {
  user?: {
    id: number
    email: string
    role_id: number
  }
}

/**
 * Middleware para verificar el token JWT
 */
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' })
      return
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader

    if (!token) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number
      email: string
      role_id: number
    }

    // Agregar usuario a la request
    req.user = decoded

    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token:', error.message)
      res.status(401).json({ error: 'Invalid token' })
      return
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired')
      res.status(401).json({ error: 'Token expired' })
      return
    }

    logger.error('Auth middleware error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Middleware para verificar roles específicos
 */
export const requireRole = (...allowedRoles: number[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!allowedRoles.includes(req.user.role_id)) {
      logger.warn(`User ${req.user.id} attempted to access restricted resource`)
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }

    next()
  }
}

/**
 * Middleware para verificar permisos específicos basados en la base de datos
 */
export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    try {
      const { getLocalPool } = await import('../config/database')
      const [rows] = await getLocalPool().execute<any[]>(
        'SELECT permissions FROM roles WHERE id = ?',
        [req.user.role_id]
      )

      if (rows.length === 0) {
        res.status(403).json({ error: 'Role not found' })
        return
      }

      const rolePermissions = typeof rows[0].permissions === 'string'
        ? JSON.parse(rows[0].permissions)
        : rows[0].permissions

      // "all" es el permiso comodín para administradores
      if (rolePermissions.includes('all') || rolePermissions.includes(permission)) {
        next()
      } else {
        logger.warn(`User ${req.user.id} denied access to permission: ${permission}`)
        res.status(403).json({ error: `Insufficient permissions: ${permission} required` })
      }
    } catch (error) {
      logger.error('Permission check error:', error)
      res.status(500).json({ error: 'Internal server error during permission check' })
    }
  }
}

/**
 * Genera un token JWT
 */
export const generateToken = (user: { id: number; email: string; role_id: number }): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role_id: user.role_id
    },
    JWT_SECRET as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  )
}

/**
 * Verifica un token sin lanzar error
 */
export const verifyToken = (token: string): any | null => {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export default authMiddleware
