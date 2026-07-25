import { Response } from 'express'
import fs from 'fs'
import { AuthRequest } from '../middlewares/auth'
import BulkRequestsService, { type BulkRequestStatus } from '../services/BulkRequestsService'
import { logger } from '../utils/logger'
import { getLocalPool } from '../config/database'
import { UPLOADS_DIR_PATH, CHAT_UPLOADS_DIR_PATH } from '../middlewares/upload'
import path from 'path'
import { emitBulkRequestComment } from '../websocket/server'
import { inAppNotificationsService } from '../services/InAppNotificationsService'

const bulkRequestsService = new BulkRequestsService()

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

const parseStatusQuery = (value: unknown): string[] => {
  if (value === undefined || value === null || value === '') return []
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const ALLOWED_STATUSES: BulkRequestStatus[] = ['pendiente', 'en_revision', 'ajustado', 'rechazado']

export const listBulkRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statusValues = parseStatusQuery(req.query.status)
    const invalidStatus = statusValues.find((value) => !ALLOWED_STATUSES.includes(value as BulkRequestStatus))

    if (invalidStatus) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const statuses = statusValues as BulkRequestStatus[]
    const status = statuses.length === 1 ? statuses[0] : undefined

    const branch_id = parseNumber(req.query.branch_id)
    const limit = parseNumber(req.query.limit)
    const offset = parseNumber(req.query.offset)

    const userId = req.user?.id
    const roleId = req.user?.role_id

    if (!userId || !roleId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    let branch_ids: number[] | undefined = undefined
    if (roleId === 2) {
      const pool = getLocalPool()
      const [rows] = await pool.execute('SELECT branch_id FROM user_branches WHERE user_id = ?', [userId])
      branch_ids = (rows as any[]).map((r) => r.branch_id)
    }

    const result = await bulkRequestsService.listRequests({
      status,
      statuses: statuses.length > 1 ? statuses : undefined,
      branch_id,
      branch_ids,
      priority: req.query.priority as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      limit,
      offset
    })

    res.json(result)
  } catch (error) {
    logger.error('List bulk requests error:', error)
    res.status(500).json({ error: 'Failed to list bulk requests' })
  }
}

export const getBulkRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid bulk request ID' })
      return
    }

    const bulkRequest = await bulkRequestsService.getById(id)
    if (!bulkRequest) {
      res.status(404).json({ error: 'Bulk request not found' })
      return
    }

    res.json(bulkRequest)
  } catch (error) {
    logger.error('Get bulk request error:', error)
    res.status(500).json({ error: 'Failed to get bulk request' })
  }
}

export const createBulkRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const files = (req.files as Express.Multer.File[] | undefined) || []
    if (files.length === 0) {
      res.status(400).json({ error: 'Debes adjuntar al menos un archivo' })
      return
    }

    const branch_id = parseNumber(req.body?.branch_id)
    const warehouse_id = parseNumber(req.body?.warehouse_id)
    const responsible_user_id = parseNumber(req.body?.responsible_user_id)
    const priority = req.body?.priority ? String(req.body.priority) : 'media'
    const notes = req.body?.notes !== undefined ? String(req.body.notes).trim() : ''
    const warehouse_name = req.body?.warehouse_name !== undefined ? String(req.body.warehouse_name) : undefined

    if (!branch_id || !warehouse_id || !responsible_user_id || !notes) {
      for (const file of files) {
        fs.unlink(file.path, () => undefined)
      }
      res.status(400).json({ error: 'Sucursal, almacén, responsable y observaciones son obligatorios' })
      return
    }

    const created = await bulkRequestsService.create({
      branch_id,
      warehouse_id,
      warehouse_name,
      priority,
      responsible_user_id,
      requested_by_user_id: userId,
      notes,
      files: files.map((file) => ({
        original_name: file.originalname,
        stored_name: file.filename,
        mime_type: file.mimetype,
        size_bytes: file.size
      }))
    })

    res.status(201).json(created)
  } catch (error) {
    logger.error('Create bulk request error:', error)
    const files = (req.files as Express.Multer.File[] | undefined) || []
    for (const file of files) {
      fs.unlink(file.path, () => undefined)
    }
    res.status(500).json({ error: 'Failed to create bulk request' })
  }
}

export const updateBulkRequestStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid bulk request ID' })
      return
    }

    const statusRaw = req.body?.status !== undefined ? String(req.body.status) : undefined
    if (!statusRaw || !ALLOWED_STATUSES.includes(statusRaw as BulkRequestStatus)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const movement_number =
      req.body?.movement_number !== undefined ? String(req.body.movement_number).trim() : undefined
    const resolution_notes =
      req.body?.resolution_notes !== undefined ? String(req.body.resolution_notes).trim() : undefined

    const updated = await bulkRequestsService.updateStatus(id, {
      status: statusRaw as BulkRequestStatus,
      movement_number,
      resolution_notes,
      reviewed_by_user_id: userId
    })

    res.json(updated)
  } catch (error) {
    logger.error('Update bulk request status error:', error)
    if (error instanceof Error && error.message === 'Bulk request not found') {
      res.status(404).json({ error: 'Bulk request not found' })
      return
    }
    if (error instanceof Error && error.message === 'Invalid status transition') {
      res.status(400).json({ error: 'Transicion de estatus invalida' })
      return
    }
    if (error instanceof Error && error.message === 'Movement number is required') {
      res.status(400).json({ error: 'El número de movimiento es obligatorio' })
      return
    }
    if (error instanceof Error && error.message === 'Resolution notes are required') {
      res.status(400).json({ error: 'El motivo de rechazo es obligatorio' })
      return
    }
    res.status(500).json({ error: 'Failed to update bulk request status' })
  }
}

export const downloadBulkRequestFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
      res.status(400).json({ error: 'Invalid ID' })
      return
    }

    const bulkRequest = await bulkRequestsService.getById(id)
    if (!bulkRequest) {
      res.status(404).json({ error: 'Bulk request not found' })
      return
    }

    const file = bulkRequest.files?.find((f) => f.id === fileId)
    if (!file) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const filePath = path.join(UPLOADS_DIR_PATH, file.stored_name)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    const pool = getLocalPool()
    await pool.execute(
      'INSERT INTO bulk_request_file_downloads (bulk_request_file_id, user_id) VALUES (?, ?)',
      [fileId, userId]
    )

    res.download(filePath, file.original_name)
  } catch (error) {
    logger.error('Download bulk request file error:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
}

export const listBulkRequestFileDownloads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const fileId = Number(req.params.fileId)
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
      res.status(400).json({ error: 'Invalid ID' })
      return
    }

    const pool = getLocalPool()
    const [fileRows] = await pool.execute<any[]>(
      'SELECT id FROM bulk_request_files WHERE id = ? AND bulk_request_id = ?',
      [fileId, id]
    )
    if (!fileRows.length) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const [rows] = await pool.execute<any[]>(
      `SELECT d.id, d.user_id, d.downloaded_at, u.name AS user_name
       FROM bulk_request_file_downloads d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.bulk_request_file_id = ?
       ORDER BY d.downloaded_at DESC`,
      [fileId]
    )

    res.json({ downloads: rows })
  } catch (error) {
    logger.error('List bulk request file downloads error:', error)
    res.status(500).json({ error: 'Failed to list file downloads' })
  }
}

export const listBulkRequestComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bulkRequestId = Number(req.params.id)
    if (!Number.isFinite(bulkRequestId) || bulkRequestId <= 0) {
      res.status(400).json({ error: 'Invalid bulk request ID' })
      return
    }

    const pool = getLocalPool()
    const [rows] = await pool.execute<any[]>(
      `SELECT bc.id, bc.bulk_request_id, bc.user_id, bc.message, bc.created_at,
              bc.attachment_original_name, bc.attachment_mime_type, bc.attachment_size_bytes,
              u.name AS user_name
       FROM bulk_request_comments bc
       LEFT JOIN users u ON u.id = bc.user_id
       WHERE bc.bulk_request_id = ?
       ORDER BY bc.created_at ASC`,
      [bulkRequestId]
    )

    res.json({ comments: rows })
  } catch (error) {
    logger.error('List bulk request comments error:', error)
    res.status(500).json({ error: 'Failed to list comments' })
  }
}

export const createBulkRequestComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const bulkRequestId = Number(req.params.id)
    if (!Number.isFinite(bulkRequestId) || bulkRequestId <= 0) {
      res.status(400).json({ error: 'Invalid bulk request ID' })
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

    const [bulkRows] = await pool.execute<any[]>('SELECT id, folio FROM bulk_requests WHERE id = ?', [bulkRequestId])
    if (!bulkRows.length) {
      res.status(404).json({ error: 'Bulk request not found' })
      return
    }

    const [result] = await pool.execute<any>(
      `INSERT INTO bulk_request_comments
        (bulk_request_id, user_id, message, attachment_original_name, attachment_stored_name, attachment_mime_type, attachment_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        bulkRequestId,
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
      `SELECT bc.id, bc.bulk_request_id, bc.user_id, bc.message, bc.created_at,
              bc.attachment_original_name, bc.attachment_mime_type, bc.attachment_size_bytes,
              u.name AS user_name
       FROM bulk_request_comments bc
       LEFT JOIN users u ON u.id = bc.user_id
       WHERE bc.id = ?`,
      [newId]
    )

    const comment = newRows[0]

    emitBulkRequestComment(bulkRequestId, comment)

    const recipients = await inAppNotificationsService.getBulkRequestRecipients(bulkRequestId, userId)
    await inAppNotificationsService.notify(recipients, {
      actor_user_id: userId,
      type: 'bulk_request_comment',
      entity_type: 'bulk_request',
      entity_id: bulkRequestId,
      title: `Nuevo mensaje en ${bulkRows[0].folio}`,
      body: message ? message.slice(0, 140) : `Adjuntó un archivo: ${file?.originalname ?? ''}`,
      link: `/solicitudes-masivas?open=${bulkRequestId}`
    })

    res.status(201).json(comment)
  } catch (error) {
    logger.error('Create bulk request comment error:', error)
    if (file) fs.unlink(file.path, () => undefined)
    res.status(500).json({ error: 'Failed to create comment' })
  }
}

export const downloadBulkCommentAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bulkRequestId = Number(req.params.id)
    const commentId = Number(req.params.commentId)
    if (
      !Number.isFinite(bulkRequestId) || bulkRequestId <= 0 ||
      !Number.isFinite(commentId) || commentId <= 0
    ) {
      res.status(400).json({ error: 'Invalid ID' })
      return
    }

    const pool = getLocalPool()
    const [rows] = await pool.execute<any[]>(
      'SELECT attachment_original_name, attachment_stored_name FROM bulk_request_comments WHERE id = ? AND bulk_request_id = ?',
      [commentId, bulkRequestId]
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
    logger.error('Download bulk comment attachment error:', error)
    res.status(500).json({ error: 'Failed to download attachment' })
  }
}

export default {
  listBulkRequests,
  getBulkRequest,
  createBulkRequest,
  updateBulkRequestStatus,
  downloadBulkRequestFile,
  listBulkRequestFileDownloads,
  listBulkRequestComments,
  createBulkRequestComment,
  downloadBulkCommentAttachment
}
