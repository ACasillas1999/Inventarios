import { getLocalPool } from '../config/database'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { emitBulkRequestStatus, emitBulkRequestCreated } from '../websocket/server'
import { auditService } from './AuditService'
import { settingsService } from './SettingsService'
import { inAppNotificationsService } from './InAppNotificationsService'

export type BulkRequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado'

const bulkRequestStatusLabel: Record<BulkRequestStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  ajustado: 'Ajustado',
  rechazado: 'Rechazado'
}

const bulkRequestStatusTransitions: Record<BulkRequestStatus, BulkRequestStatus[]> = {
  pendiente: ['en_revision'],
  en_revision: ['ajustado', 'rechazado'],
  ajustado: [],
  rechazado: []
}

const canTransitionBulkRequestStatus = (from: BulkRequestStatus, to: BulkRequestStatus): boolean =>
  from === to || bulkRequestStatusTransitions[from].includes(to)

const bulkRequestSelectQuery = `
  SELECT
    br.*,
    b.name as branch_name,
    u_responsible.name as responsible_name,
    u_requested.name as requested_by_name,
    u_reviewed.name as reviewed_by_name
  FROM bulk_requests br
  LEFT JOIN branches b ON br.branch_id = b.id
  LEFT JOIN users u_responsible ON br.responsible_user_id = u_responsible.id
  LEFT JOIN users u_requested ON br.requested_by_user_id = u_requested.id
  LEFT JOIN users u_reviewed ON br.reviewed_by_user_id = u_reviewed.id
`

export type BulkRequestFileRow = {
  id: number
  bulk_request_id: number
  original_name: string
  stored_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type BulkRequestRow = {
  id: number
  folio: string
  branch_id: number
  branch_name?: string
  warehouse_id: number
  warehouse_name: string | null
  classification: 'ajuste'
  priority: string
  responsible_user_id: number
  responsible_name?: string
  requested_by_user_id: number
  requested_by_name?: string
  notes: string
  status: BulkRequestStatus
  movement_number: string | null
  resolution_notes: string | null
  reviewed_by_user_id: number | null
  reviewed_by_name?: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  files?: BulkRequestFileRow[]
}

export class BulkRequestsService {
  private pool = getLocalPool()

  private async generateFolio(): Promise<string> {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    const format = await settingsService.getSettingValue('bulk_folio_format', 'DIFM-{YEAR}{MONTH}-{NUMBER}')

    const prefixMatch = format.match(/^(.*)\{NUMBER\}/)
    let searchPattern = 'DIFM-%'
    let prefix = 'DIFM-'

    if (prefixMatch) {
      prefix = prefixMatch[1]
        .replace('{YEAR}', year)
        .replace('{MONTH}', month)
        .replace('{DAY}', day)
      searchPattern = `${prefix}%`
    }

    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT folio FROM bulk_requests WHERE folio LIKE ? ORDER BY id DESC LIMIT 1`,
      [searchPattern]
    )

    let number = 1
    if (rows.length > 0) {
      const lastFolio = rows[0].folio as string
      const numberMatch = lastFolio.substring(prefix.length).match(/^(\d+)/)
      if (numberMatch) {
        number = parseInt(numberMatch[1]) + 1
      }
    }

    const numStr = String(number).padStart(4, '0')
    return format
      .replace('{YEAR}', year)
      .replace('{MONTH}', month)
      .replace('{DAY}', day)
      .replace('{NUMBER}', numStr)
  }

  async getById(id: number): Promise<BulkRequestRow | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`${bulkRequestSelectQuery} WHERE br.id = ? LIMIT 1`, [
      id
    ])
    if (!rows.length) return null
    const bulkRequest = rows[0] as any

    const [fileRows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM bulk_request_files WHERE bulk_request_id = ? ORDER BY id ASC`,
      [id]
    )
    bulkRequest.files = fileRows as any

    return bulkRequest
  }

  async listRequests(filters: {
    status?: BulkRequestStatus
    statuses?: BulkRequestStatus[]
    branch_id?: number
    branch_ids?: number[]
    requested_by_user_id?: number
    priority?: string
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
  }): Promise<{ requests: BulkRequestRow[]; total: number }> {
    let query = `${bulkRequestSelectQuery} WHERE 1=1`
    let countQuery = 'SELECT COUNT(*) as total FROM bulk_requests br WHERE 1=1'
    const params: any[] = []

    const statusFilters =
      Array.isArray(filters.statuses) && filters.statuses.length
        ? filters.statuses
        : filters.status
          ? [filters.status]
          : []

    if (statusFilters.length) {
      const placeholders = statusFilters.map(() => '?').join(', ')
      query += ` AND br.status IN (${placeholders})`
      countQuery += ` AND br.status IN (${placeholders})`
      params.push(...statusFilters)
    }

    if (filters.branch_id) {
      query += ' AND br.branch_id = ?'
      countQuery += ' AND br.branch_id = ?'
      params.push(filters.branch_id)
    }

    if (filters.branch_ids !== undefined) {
      if (filters.branch_ids.length > 0) {
        const placeholders = filters.branch_ids.map(() => '?').join(', ')
        query += ` AND br.branch_id IN (${placeholders})`
        countQuery += ` AND br.branch_id IN (${placeholders})`
        params.push(...filters.branch_ids)
      } else {
        query += ' AND 1 = 0'
        countQuery += ' AND 1 = 0'
      }
    }

    if (filters.requested_by_user_id) {
      query += ' AND br.requested_by_user_id = ?'
      countQuery += ' AND br.requested_by_user_id = ?'
      params.push(filters.requested_by_user_id)
    }

    if (filters.priority) {
      query += ' AND br.priority = ?'
      countQuery += ' AND br.priority = ?'
      params.push(filters.priority)
    }

    if (filters.date_from) {
      query += ' AND br.created_at >= ?'
      countQuery += ' AND br.created_at >= ?'
      params.push(`${filters.date_from} 00:00:00`)
    }

    if (filters.date_to) {
      query += ' AND br.created_at <= ?'
      countQuery += ' AND br.created_at <= ?'
      params.push(`${filters.date_to} 23:59:59`)
    }

    query += ' ORDER BY br.created_at DESC'

    const limit = typeof filters.limit === 'number' ? filters.limit : 50
    const offset = typeof filters.offset === 'number' ? filters.offset : 0
    query += ' LIMIT ? OFFSET ?'
    const queryParams = [...params, limit, offset]

    const [rows] = await this.pool.execute<RowDataPacket[]>(query, queryParams)
    const [countRows] = await this.pool.execute<RowDataPacket[]>(countQuery, params)

    const ids = (rows as any[]).map((r) => r.id)
    const filesByRequest = new Map<number, BulkRequestFileRow[]>()
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(', ')
      const [fileRows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM bulk_request_files WHERE bulk_request_id IN (${placeholders}) ORDER BY id ASC`,
        ids
      )
      for (const file of fileRows as any[]) {
        const list = filesByRequest.get(file.bulk_request_id) || []
        list.push(file)
        filesByRequest.set(file.bulk_request_id, list)
      }
    }

    const requests = (rows as any[]).map((row) => ({
      ...row,
      files: filesByRequest.get(row.id) || []
    }))

    return {
      requests,
      total: Number(countRows?.[0]?.total ?? 0)
    }
  }

  async create(data: {
    branch_id: number
    warehouse_id: number
    warehouse_name?: string | null
    priority: string
    responsible_user_id: number
    requested_by_user_id: number
    notes: string
    files: Array<{ original_name: string; stored_name: string; mime_type: string | null; size_bytes: number }>
  }): Promise<BulkRequestRow> {
    if (!data.files.length) {
      throw new Error('At least one file is required')
    }
    if (data.files.length > 3) {
      throw new Error('A maximum of 3 files is allowed')
    }

    const folio = await this.generateFolio()
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO bulk_requests
          (folio, branch_id, warehouse_id, warehouse_name, classification, priority, responsible_user_id, requested_by_user_id, notes, status)
         VALUES (?, ?, ?, ?, 'ajuste', ?, ?, ?, ?, 'pendiente')`,
        [
          folio,
          data.branch_id,
          data.warehouse_id,
          data.warehouse_name || null,
          data.priority,
          data.responsible_user_id,
          data.requested_by_user_id,
          data.notes
        ]
      )

      const bulkRequestId = result.insertId

      for (const file of data.files) {
        await connection.execute(
          `INSERT INTO bulk_request_files (bulk_request_id, original_name, stored_name, mime_type, size_bytes)
           VALUES (?, ?, ?, ?, ?)`,
          [bulkRequestId, file.original_name, file.stored_name, file.mime_type, file.size_bytes]
        )
      }

      await connection.commit()

      const created = await this.getById(bulkRequestId)
      if (!created) throw new Error('Bulk request not found after creation')

      emitBulkRequestCreated(created)

      await auditService.log({
        user_id: data.requested_by_user_id,
        action: 'CREATE_BULK_REQUEST',
        entity_type: 'bulk_request',
        entity_id: bulkRequestId,
        new_values: created
      })

      return created
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async updateStatus(
    id: number,
    data: {
      status: BulkRequestStatus
      movement_number?: string | null
      resolution_notes?: string | null
      reviewed_by_user_id: number
    }
  ): Promise<BulkRequestRow> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Bulk request not found')

    if (!canTransitionBulkRequestStatus(existing.status, data.status)) {
      throw new Error('Invalid status transition')
    }

    if (data.status === 'ajustado' && !data.movement_number?.trim()) {
      throw new Error('Movement number is required')
    }

    if (data.status === 'rechazado' && !data.resolution_notes?.trim()) {
      throw new Error('Resolution notes are required')
    }

    const updates: string[] = ['status = ?', 'reviewed_by_user_id = ?', 'reviewed_at = NOW()']
    const params: any[] = [data.status, data.reviewed_by_user_id]

    if (data.movement_number !== undefined) {
      updates.push('movement_number = ?')
      params.push(data.movement_number)
    }

    if (data.resolution_notes !== undefined) {
      updates.push('resolution_notes = ?')
      params.push(data.resolution_notes)
    }

    params.push(id)
    await this.pool.execute(`UPDATE bulk_requests SET ${updates.join(', ')} WHERE id = ?`, params)

    const updated = await this.getById(id)
    if (!updated) throw new Error('Bulk request not found after update')

    emitBulkRequestStatus(id, updated.folio, existing.status, data.status)

    await auditService.log({
      user_id: data.reviewed_by_user_id,
      action: 'UPDATE_BULK_REQUEST_STATUS',
      entity_type: 'bulk_request',
      entity_id: id,
      old_values: existing,
      new_values: data
    })

    const recipients = await inAppNotificationsService.getBulkRequestRecipients(id, data.reviewed_by_user_id)
    await inAppNotificationsService.notify(recipients, {
      actor_user_id: data.reviewed_by_user_id,
      type: 'bulk_request_status',
      entity_type: 'bulk_request',
      entity_id: id,
      title: `Cambio de estatus: ${updated.folio}`,
      body: `${bulkRequestStatusLabel[existing.status]} → ${bulkRequestStatusLabel[data.status]}`,
      link: `/solicitudes-masivas?open=${id}`
    })

    return updated
  }
}

export const bulkRequestsService = new BulkRequestsService()

export default BulkRequestsService
