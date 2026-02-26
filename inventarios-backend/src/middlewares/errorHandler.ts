import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export interface ApiError extends Error {
  status?: number
  code?: string
}

/**
 * Middleware para manejo centralizado de errores
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log del error
  logger.error('Error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  })

  // Determinar código de estado
  const status = err.status || 500
  const message = err.message || 'Internal server error'
  const code = err.code || 'INTERNAL_ERROR'

  // Responder al cliente
  res.status(status).json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

/**
 * Middleware para rutas no encontradas
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn(`Route not found: ${req.method} ${req.url}`)
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND'
  })
}

/**
 * Crea un error de API con código de estado
 */
export const createError = (message: string, status: number = 500, code?: string): ApiError => {
  const error: ApiError = new Error(message)
  error.status = status
  error.code = code
  return error
}

export default errorHandler
