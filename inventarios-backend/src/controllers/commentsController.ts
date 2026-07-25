import { Response } from 'express'
import fs from 'fs'
import path from 'path'
import { AuthRequest } from '../middlewares/auth'
import { getLocalPool } from '../config/database'
import { logger } from '../utils/logger'
import { emitRequestComment } from '../websocket/server'
import { inAppNotificationsService } from '../services/InAppNotificationsService'
import { CHAT_UPLOADS_DIR_PATH } from '../middlewares/upload'

export const listComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requestId = Number(req.params.id)
    if (!Number.isFinite(requestId) || requestId <= 0) {
      res.status(400).json({ error: 'Invalid request ID' })
      return
    }

    const pool = getLocalPool()
    const [rows] = await pool.execute<any[]>(
      `SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              rc.attachment_original_name, rc.attachment_mime_type, rc.attachment_size_bytes,
              u.name AS user_name
       FROM request_comments rc
       LEFT JOIN users u ON u.id = rc.user_id
       WHERE rc.request_id = ?
       ORDER BY rc.created_at ASC`,
      [requestId]
    )

    res.json({ comments: rows })
  } catch (error) {
    logger.error('List comments error:', error)
    res.status(500).json({ error: 'Failed to list comments' })
  }
}

export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const requestId = Number(req.params.id)
    if (!Number.isFinite(requestId) || requestId <= 0) {
      res.status(400).json({ error: 'Invalid request ID' })
      return
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!message && !file) {
      res.status(400).json({ error: 'Message or attachment is required' })
      return
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'Message too long (max 2000 chars)' })
      return
    }

    const pool = getLocalPool()

    // Verify request exists
    const [reqRows] = await pool.execute<any[]>('SELECT id, folio FROM requests WHERE id = ?', [requestId])
    if (!reqRows.length) {
      res.status(404).json({ error: 'Request not found' })
      return
    }

    const [result] = await pool.execute<any>(
      `INSERT INTO request_comments
        (request_id, user_id, message, attachment_original_name, attachment_stored_name, attachment_mime_type, attachment_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        userId,
        message,
        file ? file.originalname : null,
        file ? file.filename : null,
        file ? file.mimetype : null,
        file ? file.size : null
      ]
    )

    const newId = result.insertId

    const [newRows] = await pool.execute<any[]>(
      `SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              rc.attachment_original_name, rc.attachment_mime_type, rc.attachment_size_bytes,
              u.name AS user_name
       FROM request_comments rc
       LEFT JOIN users u ON u.id = rc.user_id
       WHERE rc.id = ?`,
      [newId]
    )

    const comment = newRows[0]

    // Emit via WebSocket to the request room
    emitRequestComment(requestId, comment)

    const recipients = await inAppNotificationsService.getRequestRecipients(requestId, userId)
    await inAppNotificationsService.notify(recipients, {
      actor_user_id: userId,
      type: 'request_comment',
      entity_type: 'request',
      entity_id: requestId,
      title: `Nuevo mensaje en ${reqRows[0].folio}`,
      body: message ? message.slice(0, 140) : `Adjuntó un archivo: ${file?.originalname ?? ''}`,
      link: `/solicitudes?open=${requestId}`
    })

    res.status(201).json(comment)
  } catch (error) {
    logger.error('Create comment error:', error)
    if (file) fs.unlink(file.path, () => undefined)
    res.status(500).json({ error: 'Failed to create comment' })
  }
}

export const downloadCommentAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requestId = Number(req.params.id)
    const commentId = Number(req.params.commentId)
    if (!Number.isFinite(requestId) || requestId <= 0 || !Number.isFinite(commentId) || commentId <= 0) {
      res.status(400).json({ error: 'Invalid ID' })
      return
    }

    const pool = getLocalPool()
    const [rows] = await pool.execute<any[]>(
      'SELECT attachment_original_name, attachment_stored_name FROM request_comments WHERE id = ? AND request_id = ?',
      [commentId, requestId]
    )

    if (!rows.length || !rows[0].attachment_stored_name) {
      res.status(404).json({ error: 'Attachment not found' })
      return
    }

    const filePath = path.join(CHAT_UPLOADS_DIR_PATH, rows[0].attachment_stored_name)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    res.download(filePath, rows[0].attachment_original_name)
  } catch (error) {
    logger.error('Download comment attachment error:', error)
    res.status(500).json({ error: 'Failed to download attachment' })
  }
}

export default { listComments, createComment, downloadCommentAttachment }
