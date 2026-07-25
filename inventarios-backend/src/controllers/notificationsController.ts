import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { inAppNotificationsService, type NotificationEntityType } from '../services/InAppNotificationsService'
import { logger } from '../utils/logger'

export const listNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const result = await inAppNotificationsService.list(userId, 30)
    res.json(result)
  } catch (error) {
    logger.error('List notifications error:', error)
    res.status(500).json({ error: 'Failed to list notifications' })
  }
}

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid notification ID' })
      return
    }

    await inAppNotificationsService.markRead(userId, id)
    res.json({ message: 'ok' })
  } catch (error) {
    logger.error('Mark notification read error:', error)
    res.status(500).json({ error: 'Failed to mark notification read' })
  }
}

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    await inAppNotificationsService.markAllRead(userId)
    res.json({ message: 'ok' })
  } catch (error) {
    logger.error('Mark all notifications read error:', error)
    res.status(500).json({ error: 'Failed to mark notifications read' })
  }
}

export const markNotificationsReadForEntity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const entityType = req.body?.entity_type as NotificationEntityType
    const entityId = Number(req.body?.entity_id)

    if (
      (entityType !== 'request' && entityType !== 'bulk_request') ||
      !Number.isFinite(entityId) ||
      entityId <= 0
    ) {
      res.status(400).json({ error: 'Invalid entity_type or entity_id' })
      return
    }

    await inAppNotificationsService.markReadForEntity(userId, entityType, entityId)
    res.json({ message: 'ok' })
  } catch (error) {
    logger.error('Mark notifications read for entity error:', error)
    res.status(500).json({ error: 'Failed to mark notifications read' })
  }
}

export default {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsReadForEntity
}
