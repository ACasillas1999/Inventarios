import { getLocalPool } from '../config/database'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { emitNotification } from '../websocket/server'
import { logger } from '../utils/logger'

export type NotificationType = 'request_comment' | 'request_status' | 'bulk_request_comment' | 'bulk_request_status'
export type NotificationEntityType = 'request' | 'bulk_request'

export interface NotificationRow {
  id: number
  user_id: number
  actor_user_id: number | null
  actor_name?: string | null
  type: NotificationType
  entity_type: NotificationEntityType
  entity_id: number
  title: string
  body: string | null
  link: string
  is_read: boolean
  created_at: string
}

export class InAppNotificationsService {
  private pool = getLocalPool()

  async getRequestRecipients(requestId: number, excludeUserId: number): Promise<number[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT r.requested_by_user_id, r.reviewed_by_user_id, c.created_by_user_id, c.responsible_user_id
       FROM requests r
       LEFT JOIN counts c ON r.count_id = c.id
       WHERE r.id = ?
       LIMIT 1`,
      [requestId]
    )
    const row = rows[0]
    const ids = new Set<number>()
    if (row) {
      ;[row.requested_by_user_id, row.reviewed_by_user_id, row.created_by_user_id, row.responsible_user_id].forEach(
        (id) => {
          if (id) ids.add(Number(id))
        }
      )
    }

    const [commentRows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT user_id FROM request_comments WHERE request_id = ?',
      [requestId]
    )
    commentRows.forEach((c) => ids.add(Number(c.user_id)))

    ids.delete(excludeUserId)
    return Array.from(ids)
  }

  async getBulkRequestRecipients(bulkRequestId: number, excludeUserId: number): Promise<number[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT requested_by_user_id, responsible_user_id, reviewed_by_user_id
       FROM bulk_requests
       WHERE id = ?
       LIMIT 1`,
      [bulkRequestId]
    )
    const row = rows[0]
    const ids = new Set<number>()
    if (row) {
      ;[row.requested_by_user_id, row.responsible_user_id, row.reviewed_by_user_id].forEach((id) => {
        if (id) ids.add(Number(id))
      })
    }

    const [commentRows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT user_id FROM bulk_request_comments WHERE bulk_request_id = ?',
      [bulkRequestId]
    )
    commentRows.forEach((c) => ids.add(Number(c.user_id)))

    ids.delete(excludeUserId)
    return Array.from(ids)
  }

  async notify(
    recipients: number[],
    data: {
      actor_user_id: number | null
      type: NotificationType
      entity_type: NotificationEntityType
      entity_id: number
      title: string
      body?: string | null
      link: string
    }
  ): Promise<void> {
    if (!recipients.length) return

    try {
      for (const userId of recipients) {
        const [result] = await this.pool.execute<ResultSetHeader>(
          `INSERT INTO notifications (user_id, actor_user_id, type, entity_type, entity_id, title, body, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            data.actor_user_id,
            data.type,
            data.entity_type,
            data.entity_id,
            data.title,
            data.body || null,
            data.link
          ]
        )

        const [rows] = await this.pool.execute<RowDataPacket[]>(
          `SELECT n.*, u.name AS actor_name
           FROM notifications n
           LEFT JOIN users u ON u.id = n.actor_user_id
           WHERE n.id = ?`,
          [result.insertId]
        )

        if (rows[0]) {
          emitNotification(userId, rows[0])
        }
      }
    } catch (error) {
      logger.error('Error creating notifications:', error)
    }
  }

  async list(userId: number, limit = 30): Promise<{ notifications: NotificationRow[]; unread_count: number }> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT n.*, u.name AS actor_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [userId, limit]
    )

    const [countRows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    )

    return {
      notifications: rows as any,
      unread_count: Number(countRows[0]?.total ?? 0)
    }
  }

  async markRead(userId: number, id: number): Promise<void> {
    await this.pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId])
  }

  async markAllRead(userId: number): Promise<void> {
    await this.pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId])
  }

  async markReadForEntity(userId: number, entityType: NotificationEntityType, entityId: number): Promise<void> {
    await this.pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND is_read = 0',
      [userId, entityType, entityId]
    )
  }
}

export const inAppNotificationsService = new InAppNotificationsService()
export default InAppNotificationsService
