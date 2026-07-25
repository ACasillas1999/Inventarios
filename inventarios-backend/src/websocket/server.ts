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
      origin: true,
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

    socket.on('join_request', (requestId: number) => {
      socket.join(`request:${requestId}`)
      logger.debug(`User ${user.id} joined request ${requestId}`)
    })

    socket.on('leave_request', (requestId: number) => {
      socket.leave(`request:${requestId}`)
      logger.debug(`User ${user.id} left request ${requestId}`)
    })

    socket.on('join_bulk_request', (bulkRequestId: number) => {
      socket.join(`bulk_request:${bulkRequestId}`)
      logger.debug(`User ${user.id} joined bulk request ${bulkRequestId}`)
    })

    socket.on('leave_bulk_request', (bulkRequestId: number) => {
      socket.leave(`bulk_request:${bulkRequestId}`)
      logger.debug(`User ${user.id} left bulk request ${bulkRequestId}`)
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
 * Emite un evento de cambio de estado de solicitud masiva
 */
export const emitBulkRequestStatus = (
  bulkRequestId: number,
  folio: string,
  oldStatus: string,
  newStatus: string
): void => {
  if (!io) return

  io.emit('bulk_request_status', {
    type: 'bulk_request_status',
    data: {
      bulk_request_id: bulkRequestId,
      folio,
      old_status: oldStatus,
      new_status: newStatus
    },
    timestamp: new Date()
  })

  logger.debug(`Bulk request status change emitted for bulk request ${bulkRequestId}: ${oldStatus} -> ${newStatus}`)
}

/**
 * Emite un evento cuando se crea una nueva solicitud masiva
 */
export const emitBulkRequestCreated = (bulkRequest: any): void => {
  if (!io) return

  io.emit('bulk_request_created', {
    type: 'bulk_request_created',
    data: bulkRequest,
    timestamp: new Date()
  })

  logger.debug(`Bulk request created emitted: ${bulkRequest.folio}`)
}

/**
 * Emite un evento cuando se crea una nueva solicitud
 */
export const emitRequestCreated = (request: any): void => {
  if (!io) return

  io.emit('request_created', {
    type: 'request_created',
    data: request,
    timestamp: new Date()
  })

  logger.debug(`Request created emitted: ${request.folio}`)
}

/**
 * Emite un evento cuando se crea un nuevo conteo
 */
export const emitCountCreated = (count: any): void => {
  if (!io) return

  io.emit('count_created', {
    type: 'count_created',
    data: count,
    timestamp: new Date()
  })

  logger.debug(`Count created emitted: ${count.folio}`)
}

/**
 * Emite un evento cuando cambia el estado de un conteo
 */
export const emitCountStatusChanged = (
  countId: number,
  folio: string,
  oldStatus: string,
  newStatus: string
): void => {
  if (!io) return

  io.emit('count_status_changed', {
    type: 'count_status_changed',
    data: {
      count_id: countId,
      folio,
      old_status: oldStatus,
      new_status: newStatus
    },
    timestamp: new Date()
  })

  // También emitir a la sala específica del conteo
  io.to(`count:${countId}`).emit('status_updated', {
    count_id: countId,
    status: newStatus,
    timestamp: new Date()
  })

  logger.debug(`Count status changed emitted for ${folio}: ${oldStatus} -> ${newStatus}`)
}

/**
 * Emite un evento cuando se agrega un detalle a un conteo
 */
export const emitCountDetailAdded = (countId: number, detail: any): void => {
  if (!io) return

  io.to(`count:${countId}`).emit('detail_added', {
    count_id: countId,
    detail,
    timestamp: new Date()
  })

  logger.debug(`Count detail added emitted for count ${countId}`)
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

/**
 * Emite un evento cuando se reasigna un conteo
 */
export const emitCountReassigned = (
  countId: number,
  folio: string,
  oldResponsibleId: number,
  newResponsibleId: number
): void => {
  if (!io) return

  io.emit('count_reassigned', {
    type: 'count_reassigned',
    data: {
      count_id: countId,
      folio,
      old_responsible_id: oldResponsibleId,
      new_responsible_id: newResponsibleId
    },
    timestamp: new Date()
  })

  // También emitir a la sala específica del conteo
  io.to(`count:${countId}`).emit('reassigned', {
    count_id: countId,
    responsible_id: newResponsibleId,
    timestamp: new Date()
  })

  // Emitir a salas de usuario
  io.to(`user:${oldResponsibleId}`).emit('count_unassigned', { count_id: countId, folio })
  io.to(`user:${newResponsibleId}`).emit('count_assigned', { count_id: countId, folio })

  logger.debug(`Count reassigned emitted for ${folio}: ${oldResponsibleId} -> ${newResponsibleId}`)
}

/**
 * Emite un nuevo comentario de solicitud a todos los usuarios en la sala de esa solicitud
 */
export const emitRequestComment = (requestId: number, comment: any): void => {
  if (!io) return

  io.to(`request:${requestId}`).emit('request_comment', {
    type: 'request_comment',
    data: comment,
    timestamp: new Date()
  })

  logger.debug(`Request comment emitted for request ${requestId}`)
}

/**
 * Emite una notificación en vivo a un usuario (sala user:{id}, ya se une todo socket al conectar)
 */
export const emitNotification = (userId: number, notification: any): void => {
  if (!io) return

  io.to(`user:${userId}`).emit('notification', {
    type: 'notification',
    data: notification,
    timestamp: new Date()
  })

  logger.debug(`Notification emitted to user ${userId}: ${notification.type}`)
}

/**
 * Emite un nuevo comentario de solicitud masiva a todos los usuarios en la sala de esa solicitud
 */
export const emitBulkRequestComment = (bulkRequestId: number, comment: any): void => {
  if (!io) return

  io.to(`bulk_request:${bulkRequestId}`).emit('bulk_request_comment', {
    type: 'bulk_request_comment',
    data: comment,
    timestamp: new Date()
  })

  logger.debug(`Bulk request comment emitted for bulk request ${bulkRequestId}`)
}

export default {
  initializeWebSocket,
  getWebSocketServer,
  emitStockUpdate,
  emitCountProgress,
  emitRequestStatus,
  emitRequestCreated,
  emitBulkRequestStatus,
  emitBulkRequestCreated,
  emitBulkRequestComment,
  emitNotification,
  emitCountCreated,
  emitCountStatusChanged,
  emitCountDetailAdded,
  emitCountReassigned,
  emitRequestComment,
  emitToRoom,
  emitToUser,
  emitToRole
}
