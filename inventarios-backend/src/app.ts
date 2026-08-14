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
import { ensureUploadsDirectory, ensureChatAttachmentsDirectory } from './middlewares/upload'

// Importar rutas
import authRoutes from './routes/auth.routes'
import stockRoutes from './routes/stock.routes'
import countsRoutes from './routes/counts.routes'
import branchesRoutes from './routes/branches.routes'
import usersRoutes from './routes/users.routes'
import requestsRoutes from './routes/requests.routes'
import bulkRequestsRoutes from './routes/bulkRequests.routes'
import notificationsRoutes from './routes/notifications.routes'
import rolesRoutes from './routes/roles.routes'
import specialLinesRoutes from './routes/special-lines.routes'
import reportsRoutes from './routes/reports.routes'
import auditRoutes from './routes/audit.routes'
import settingsRoutes from './routes/settings.routes'
import testDataRoutes from './routes/test-data.routes'

// Constantes
const PORT = parseInt(process.env.PORT || '3000')
const NODE_ENV = process.env.NODE_ENV || 'development'

/**
 * Inicializa la aplicación Express
 */
const createApp = (): Application => {
  const app = express()

  // Middlewares de seguridad y utilidad
  app.use(helmet())
  app.use(compression())
  app.use(cors({
    origin: true, // Accepts any origin dynamically
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
  app.use('/api/bulk-requests', bulkRequestsRoutes)
  app.use('/api/notifications', notificationsRoutes)
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

    try {
      await localPool.query("ALTER TABLE counts MODIFY COLUMN classification ENUM('inventario', 'ajuste', 'migracion', 'robo', 'garantia') NOT NULL DEFAULT 'inventario'")
      logger.info('Migration for classification ENUM executed successfully')
      
      const rolesSql = `INSERT IGNORE INTO roles (name, display_name, description, permissions, created_at, updated_at) VALUES 
        ('gerente', 'Gerente', 'Gerente de sucursal', '["counts.view", "counts.create"]', NOW(), NOW()),
        ('auxiliar_gerente', 'Auxiliar de Gerente', 'Auxiliar de gerente de sucursal', '["counts.view", "counts.create"]', NOW(), NOW())`;
      await localPool.query(rolesSql)
      logger.info('Roles migration for Gerente and Auxiliar executed successfully')
    } catch (err: any) {
      logger.warn('Migration warning:', err.message)
    }

    try {
      await localPool.query(`
        CREATE TABLE IF NOT EXISTS bulk_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          folio VARCHAR(50) NOT NULL UNIQUE,
          branch_id INT NOT NULL,
          warehouse_id INT NOT NULL,
          warehouse_name VARCHAR(255),
          classification ENUM('ajuste') NOT NULL DEFAULT 'ajuste',
          priority ENUM('baja', 'media', 'alta', 'urgente', 'mostrador') DEFAULT 'media',
          responsible_user_id INT NOT NULL,
          requested_by_user_id INT NOT NULL,
          notes TEXT NOT NULL,
          status ENUM('pendiente', 'en_revision', 'ajustado', 'rechazado') DEFAULT 'pendiente',
          movement_number VARCHAR(100),
          resolution_notes TEXT,
          reviewed_by_user_id INT,
          reviewed_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (branch_id) REFERENCES branches(id),
          FOREIGN KEY (responsible_user_id) REFERENCES users(id),
          FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
          FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id),
          INDEX idx_folio (folio),
          INDEX idx_branch (branch_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      await localPool.query(`
        CREATE TABLE IF NOT EXISTS bulk_request_files (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bulk_request_id INT NOT NULL,
          original_name VARCHAR(500) NOT NULL,
          stored_name VARCHAR(500) NOT NULL,
          mime_type VARCHAR(150),
          size_bytes INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bulk_request_id) REFERENCES bulk_requests(id) ON DELETE CASCADE,
          INDEX idx_bulk_request (bulk_request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      await localPool.query(`
        CREATE TABLE IF NOT EXISTS bulk_request_file_downloads (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bulk_request_file_id INT NOT NULL,
          user_id INT NOT NULL,
          downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bulk_request_file_id) REFERENCES bulk_request_files(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id),
          INDEX idx_file (bulk_request_file_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      await localPool.query(`
        UPDATE roles
        SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'bulk_requests.create')
        WHERE name IN ('jefe_inventarios', 'e_inventarios', 'gerente', 'auxiliar_gerente')
          AND NOT JSON_CONTAINS(permissions, '"bulk_requests.create"')
      `)

      await localPool.query(`
        UPDATE roles
        SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'bulk_requests.manage')
        WHERE name IN ('jefe_inventarios', 'e_inventarios')
          AND NOT JSON_CONTAINS(permissions, '"bulk_requests.manage"')
      `)

      await localPool.query(`
        CREATE TABLE IF NOT EXISTS bulk_request_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bulk_request_id INT NOT NULL,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bulk_request_id) REFERENCES bulk_requests(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id),
          INDEX idx_bulk_request (bulk_request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      logger.info('Bulk requests migration executed successfully')
    } catch (err: any) {
      logger.warn('Bulk requests migration warning:', err.message)
    }

    try {
      await localPool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          actor_user_id INT,
          type VARCHAR(50) NOT NULL,
          entity_type VARCHAR(30) NOT NULL,
          entity_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          body TEXT,
          link VARCHAR(500) NOT NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (actor_user_id) REFERENCES users(id),
          INDEX idx_user_unread (user_id, is_read),
          INDEX idx_user_created (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      logger.info('Notifications migration executed successfully')
    } catch (err: any) {
      logger.warn('Notifications migration warning:', err.message)
    }

    try {
      await localPool.query(`
        CREATE TABLE IF NOT EXISTS request_comments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          request_id INT NOT NULL,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          attachment_original_name VARCHAR(500) NULL,
          attachment_stored_name VARCHAR(500) NULL,
          attachment_mime_type VARCHAR(150) NULL,
          attachment_size_bytes INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id),
          INDEX idx_request (request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      logger.info('request_comments table verified')
    } catch (err: any) {
      logger.warn('request_comments table migration warning:', err.message)
    }

    try {
      await localPool.query(`
        ALTER TABLE request_comments
          ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(500) NULL,
          ADD COLUMN IF NOT EXISTS attachment_stored_name VARCHAR(500) NULL,
          ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(150) NULL,
          ADD COLUMN IF NOT EXISTS attachment_size_bytes INT NULL
      `)

      logger.info('request_comments attachment columns verified')
    } catch (err: any) {
      logger.warn('request_comments attachment columns migration warning:', err.message)
    }

    try {
      await localPool.query(`
        ALTER TABLE bulk_request_comments
          ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(500) NULL,
          ADD COLUMN IF NOT EXISTS attachment_stored_name VARCHAR(500) NULL,
          ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(150) NULL,
          ADD COLUMN IF NOT EXISTS attachment_size_bytes INT NULL
      `)

      logger.info('bulk_request_comments attachment columns verified')
    } catch (err: any) {
      logger.warn('bulk_request_comments attachment columns migration warning:', err.message)
    }

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
    ensureUploadsDirectory()
    ensureChatAttachmentsDirectory()

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

    httpServer.listen(PORT, '0.0.0.0', () => {
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
