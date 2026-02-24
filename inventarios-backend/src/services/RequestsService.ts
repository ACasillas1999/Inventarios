import { getLocalPool } from '../config/database'
import { RowDataPacket } from 'mysql2/promise'
import { emitRequestStatus } from '../websocket/server'
import { auditService } from './AuditService'

export type RequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado'

const requestStatusTransitions: Record<RequestStatus, RequestStatus[]> = {
  pendiente: ['en_revision'],
  en_revision: ['ajustado', 'rechazado'],
  ajustado: [],
  rechazado: [],
}

const canTransitionRequestStatus = (from: RequestStatus, to: RequestStatus): boolean =>
  from === to || requestStatusTransitions[from].includes(to)

const requestSelectQuery = `
  SELECT
    r.*,
    c.folio as count_folio,
    c.classification as count_classification,
    cd.warehouse_id,
    cd.warehouse_name,
    u_requested.name as requested_by_name,
    u_reviewed.name as reviewed_by_name
  FROM requests r
  LEFT JOIN counts c ON r.count_id = c.id
  LEFT JOIN count_details cd ON r.count_detail_id = cd.id
  LEFT JOIN users u_requested ON r.requested_by_user_id = u_requested.id
  LEFT JOIN users u_reviewed ON r.reviewed_by_user_id = u_reviewed.id
`

export type RequestRow = {
  id: number
  folio: string
  count_id: number
  count_folio?: string
  count_detail_id: number
  branch_id: number
  item_code: string
  system_stock: number
  counted_stock: number
  difference: number
  status: RequestStatus
  requested_by_user_id: number
  reviewed_by_user_id: number | null
  reviewed_at: string | null
  resolution_notes: string | null
  evidence_file: string | null
  warehouse_id?: number
  warehouse_name?: string
  count_classification?: 'inventario' | 'ajuste'
  requested_by_name?: string | null
  reviewed_by_name?: string | null
  created_at: string
  updated_at: string
}

export class RequestsService {
  private pool = getLocalPool()

  async getById(id: number): Promise<RequestRow | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `${requestSelectQuery}
       WHERE r.id = ?
       LIMIT 1`,
      [id]
    )
    if (!rows.length) return null
    return rows[0] as any
  }

  async listRequests(filters: {
    status?: RequestStatus
    statuses?: RequestStatus[]
    branch_id?: number
    count_id?: number
    limit?: number
    offset?: number
  }): Promise<{ requests: RequestRow[]; total: number }> {
    let query = `${requestSelectQuery} WHERE 1=1`
    let countQuery = 'SELECT COUNT(*) as total FROM requests r WHERE 1=1'
    const params: any[] = []

    const statusFilters =
      Array.isArray(filters.statuses) && filters.statuses.length
        ? filters.statuses
        : filters.status
          ? [filters.status]
          : []

    if (statusFilters.length) {
      const placeholders = statusFilters.map(() => '?').join(', ')
      query += ` AND r.status IN (${placeholders})`
      countQuery += ` AND r.status IN (${placeholders})`
      params.push(...statusFilters)
    }

    if (filters.branch_id) {
      query += ' AND r.branch_id = ?'
      countQuery += ' AND r.branch_id = ?'
      params.push(filters.branch_id)
    }

    if (filters.count_id) {
      query += ' AND r.count_id = ?'
      countQuery += ' AND r.count_id = ?'
      params.push(filters.count_id)
    }

    query += ' ORDER BY r.created_at DESC'

    const limit = typeof filters.limit === 'number' ? filters.limit : 50
    const offset = typeof filters.offset === 'number' ? filters.offset : 0
    query += ' LIMIT ? OFFSET ?'
    const queryParams = [...params, limit, offset]

    const [rows] = await this.pool.execute<RowDataPacket[]>(query, queryParams)
    const [countRows] = await this.pool.execute<RowDataPacket[]>(countQuery, params)

    return {
      requests: rows as any,
      total: Number(countRows?.[0]?.total ?? 0)
    }
  }

  async updateRequest(
    id: number,
    data: {
      status?: RequestStatus
      resolution_notes?: string | null
      evidence_file?: string | null
      reviewed_by_user_id?: number | null
      reviewed_at?: 'NOW' | string | null
    }
  ): Promise<RequestRow> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Request not found')

    const updates: string[] = []
    const params: any[] = []
    const statusChanged = data.status !== undefined && data.status !== existing.status

    if (data.status !== undefined) {
      if (!canTransitionRequestStatus(existing.status, data.status)) {
        throw new Error('Invalid status transition')
      }

      updates.push('status = ?')
      params.push(data.status)
    }

    if (data.resolution_notes !== undefined) {
      updates.push('resolution_notes = ?')
      params.push(data.resolution_notes)
    }

    if (data.evidence_file !== undefined) {
      updates.push('evidence_file = ?')
      params.push(data.evidence_file)
    }

    if (statusChanged && data.reviewed_by_user_id !== undefined) {
      updates.push('reviewed_by_user_id = ?')
      params.push(data.reviewed_by_user_id)
    }

    if (statusChanged) {
      if (data.reviewed_at === undefined || data.reviewed_at === 'NOW') {
        updates.push('reviewed_at = NOW()')
      } else {
        updates.push('reviewed_at = ?')
        params.push(data.reviewed_at)
      }
    }

    if (!updates.length) throw new Error('No fields to update')

    params.push(id)
    await this.pool.execute(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params)

    const updated = await this.getById(id)
    if (!updated) throw new Error('Request not found after update')

    // Emitir cambio de estado
    if (data.status && data.status !== existing.status) {
      emitRequestStatus(id, updated.folio, existing.status, data.status)
    }

    // Log status update
    if (statusChanged && data.reviewed_by_user_id) {
      await auditService.log({
        user_id: data.reviewed_by_user_id,
        action: 'UPDATE_REQUEST',
        entity_type: 'request',
        entity_id: id,
        old_values: existing,
        new_values: data
      })
    }

    return updated
  }
}

export default RequestsService
