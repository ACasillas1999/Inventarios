import express, { Application, Request, Response } from 'express'
import { createServer } from 'http'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Configuración
dotenv.config()

// Importar utilidades
import { logger } from './utils/logger'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler'

// Importar gestores
import { ConnectionManager } from './connections/ConnectionManager'
import { getBranchDatabases, getLocalPool } from './config/database'
import { initializeWebSocket } from './websocket/server'
import { ensureBaseSettings } from './utils/initSettings'

// Importar rutas
import authRoutes from './routes/auth.routes'
import stockRoutes from './routes/stock.routes'
import countsRoutes from './routes/counts.routes'
import branchesRoutes from './routes/branches.routes'
import usersRoutes from './routes/users.routes'
import requestsRoutes from './routes/requests.routes'
import rolesRoutes from './routes/roles.routes'
import specialLinesRoutes from './routes/special-lines.routes'
import reportsRoutes from './routes/reports.routes'
import auditRoutes from './routes/audit.routes'
import settingsRoutes from './routes/settings.routes'
import testDataRoutes from './routes/test-data.routes'

// Constantes
const PORT = parseInt(process.env.PORT || '3000')
const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['http://localhost:5173']

/**
 * Inicializa la aplicación Express
 */
const createApp = (): Application => {
  const app = express()

  // Middlewares de seguridad y utilidad
  app.use(helmet())
  app.use(compression())
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
  }))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // Logger de requests en desarrollo
  if (NODE_ENV === 'development') {
    app.use((_req: Request, _res: Response, next) => {
      logger.debug(`${_req.method} ${_req.url}`)
      next()
    })
  }

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    const connectionManager = ConnectionManager.getInstance()
    const connectedBranches = connectionManager.getConnectedBranchesCount()
    const totalBranches = connectionManager.getAllBranchConfigs().length

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: {
        local: 'connected',
        branches: {
          connected: connectedBranches,
          total: totalBranches
        }
      }
    })
  })

  // Rutas de la API
  app.use('/api/auth', authRoutes)
  app.use('/api/stock', stockRoutes)
  app.use('/api/counts', countsRoutes)
  app.use('/api/branches', branchesRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/requests', requestsRoutes)
  app.use('/api/roles', rolesRoutes)
  app.use('/api/special-lines', specialLinesRoutes)
  app.use('/api/reports', reportsRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/settings', settingsRoutes)
  app.use('/api/test-data', testDataRoutes)

  // Ruta raíz
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Inventarios Backend API',
      version: '1.0.0',
      status: 'running',
      documentation: '/api/docs'
    })
  })

  // Manejadores de errores
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

/**
 * Inicializa las conexiones a las bases de datos
 */
const initializeDatabases = async (): Promise<void> => {
  logger.info('Initializing database connections...')

  try {
    // Verificar conexión a base de datos local
    const localPool = getLocalPool()
    await localPool.query('SELECT 1')
    logger.info('Local database connected successfully')

    // Inicializar conexiones a sucursales
    const branchDatabases = await getBranchDatabases()
    if (branchDatabases.length === 0) {
      logger.warn('No branch databases configured')
    } else {
      const connectionManager = ConnectionManager.getInstance()
      await connectionManager.initializeBranches(branchDatabases)
      logger.info(`${connectionManager.getConnectedBranchesCount()} of ${branchDatabases.length} branch databases connected`)
    }

    // Asegurar configuraciones base
    await ensureBaseSettings()
  } catch (error) {
    logger.error('Failed to initialize databases:', error)
    throw error
  }
}

/**
 * Crea el directorio de logs si no existe
 */
const ensureLogsDirectory = (): void => {
  const logsDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
    logger.info('Logs directory created')
  }
}

/**
 * Inicia el servidor
 */
const startServer = async (): Promise<void> => {
  try {
    // Asegurar que existe el directorio de logs
    ensureLogsDirectory()

    logger.info('Starting Inventarios Backend...')
    logger.info(`Environment: ${NODE_ENV}`)
    logger.info(`Port: ${PORT}`)

    // Inicializar bases de datos
    await initializeDatabases()

    // Crear aplicación Express
    const app = createApp()

    // Crear servidor HTTP
    const httpServer = createServer(app)

    // Inicializar WebSocket si está habilitado
    const wsEnabled = process.env.WS_ENABLED !== 'false'
    if (wsEnabled) {
      initializeWebSocket(httpServer)
      logger.info('WebSocket server enabled')
    } else {
      logger.info('WebSocket server disabled')
    }

    // Iniciar servidor
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`)
      logger.info(`📊 Health check: http://localhost:${PORT}/health`)
      if (wsEnabled) {
        logger.info(`🔌 WebSocket: ws://localhost:${PORT}${process.env.WS_PATH || '/ws'}`)
      }
    })

    // Manejo de cierre graceful
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully...`)

      httpServer.close(async () => {
        logger.info('HTTP server closed')

        try {
          // Cerrar conexiones a bases de datos
          const connectionManager = ConnectionManager.getInstance()
          await connectionManager.closeAll()
          logger.info('All database connections closed')

          process.exit(0)
        } catch (error) {
          logger.error('Error during shutdown:', error)
          process.exit(1)
        }
      })

      // Forzar salida después de 10 segundos
      setTimeout(() => {
        logger.error('Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    // Manejo de errores no capturados
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception:', error)
      process.exit(1)
    })

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled rejection:', reason)
      process.exit(1)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Iniciar servidor
startServer()

export { createApp }
