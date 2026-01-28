import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { verifyToken } from '../middlewares/auth'
import { logger } from '../utils/logger'

let io: SocketIOServer | null = null

/**
 * Inicializa el servidor WebSocket
 */
export const initializeWebSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: process.env.WS_PATH || '/ws'
  })

  // Middleware de autenticación para WebSocket
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization

    if (!token) {
      logger.warn('WebSocket connection attempt without token')
      return next(new Error('Authentication required'))
    }

    const decoded = verifyToken(token.replace('Bearer ', ''))
    if (!decoded) {
      logger.warn('WebSocket connection attempt with invalid token')
      return next(new Error('Invalid token'))
    }

    // Agregar usuario al socket
    socket.data.user = decoded
    next()
  })

  // Manejo de conexiones
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user
    logger.info(`WebSocket client connected: ${user.email} (${socket.id})`)

    // Unir al usuario a una sala con su ID
    socket.join(`user:${user.id}`)

    // Unir al usuario a una sala con su rol
    socket.join(`role:${user.role_id}`)

    // Eventos del cliente
    socket.on('join_count', (countId: number) => {
      socket.join(`count:${countId}`)
      logger.debug(`User ${user.id} joined count ${countId}`)
    })

    socket.on('leave_count', (countId: number) => {
      socket.leave(`count:${countId}`)
      logger.debug(`User ${user.id} left count ${countId}`)
    })

    socket.on('join_branch', (branchId: number) => {
      socket.join(`branch:${branchId}`)
      logger.debug(`User ${user.id} joined branch ${branchId}`)
    })

    socket.on('leave_branch', (branchId: number) => {
      socket.leave(`branch:${branchId}`)
      logger.debug(`User ${user.id} left branch ${branchId}`)
    })

    // Desconexión
    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${user.email} (${socket.id})`)
    })
  })

  logger.info('WebSocket server initialized')
  return io
}

/**
 * Obtiene la instancia del servidor WebSocket
 */
export const getWebSocketServer = (): SocketIOServer | null => {
  return io
}

/**
 * Emite un evento de actualización de stock
 */
export const emitStockUpdate = (branchId: number, itemCode: string, oldStock: number, newStock: number): void => {
  if (!io) return

  io.to(`branch:${branchId}`).emit('stock_updated', {
    type: 'stock_updated',
    data: {
      branch_id: branchId,
      item_code: itemCode,
      old_stock: oldStock,
      new_stock: newStock
    },
    timestamp: new Date()
  })

  logger.debug(`Stock update emitted for branch ${branchId}, item ${itemCode}`)
}

/**
 * Emite un evento de progreso de conteo
 */
export const emitCountProgress = (
  countId: number,
  folio: string,
  totalItems: number,
  countedItems: number
): void => {
  if (!io) return

  const percentage = totalItems > 0 ? (countedItems / totalItems) * 100 : 0

  io.to(`count:${countId}`).emit('count_progress', {
    type: 'count_progress',
    data: {
      count_id: countId,
      folio,
      total_items: totalItems,
      counted_items: countedItems,
      percentage: Number(percentage.toFixed(2))
    },
    timestamp: new Date()
  })

  logger.debug(`Count progress emitted for count ${countId}: ${countedItems}/${totalItems}`)
}

/**
 * Emite un evento de cambio de estado de solicitud
 */
export const emitRequestStatus = (
  requestId: number,
  folio: string,
  oldStatus: string,
  newStatus: string
): void => {
  if (!io) return

  io.emit('request_status', {
    type: 'request_status',
    data: {
      request_id: requestId,
      folio,
      old_status: oldStatus,
      new_status: newStatus
    },
    timestamp: new Date()
  })

  logger.debug(`Request status change emitted for request ${requestId}: ${oldStatus} -> ${newStatus}`)
}

/**
 * Emite un evento personalizado a una sala específica
 */
export const emitToRoom = (room: string, event: string, data: any): void => {
  if (!io) return

  io.to(room).emit(event, {
    ...data,
    timestamp: new Date()
  })
}

/**
 * Emite un evento a un usuario específico
 */
export const emitToUser = (userId: number, event: string, data: any): void => {
  emitToRoom(`user:${userId}`, event, data)
}

/**
 * Emite un evento a todos los usuarios con un rol específico
 */
export const emitToRole = (roleId: number, event: string, data: any): void => {
  emitToRoom(`role:${roleId}`, event, data)
}

export default {
  initializeWebSocket,
  getWebSocketServer,
  emitStockUpdate,
  emitCountProgress,
  emitRequestStatus,
  emitToRoom,
  emitToUser,
  emitToRole
}
