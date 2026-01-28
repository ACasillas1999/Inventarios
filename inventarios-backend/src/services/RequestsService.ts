import { getLocalPool } from '../config/database'
import { RowDataPacket } from 'mysql2/promise'

export type RequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado'

export type RequestRow = {
  id: number
  folio: string
  count_id: number
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
  created_at: string
  updated_at: string
}

export class RequestsService {
  private pool = getLocalPool()

  async getById(id: number): Promise<RequestRow | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT * FROM requests WHERE id = ?', [
      id
    ])
    if (!rows.length) return null
    return rows[0] as any
  }

  async listRequests(filters: {
    status?: RequestStatus
    branch_id?: number
    count_id?: number
    limit?: number
    offset?: number
  }): Promise<{ requests: RequestRow[]; total: number }> {
    let query = `
      SELECT 
        r.*,
        c.folio as count_folio,
        c.classification as count_classification,
        cd.warehouse_id,
        cd.warehouse_name
      FROM requests r
      LEFT JOIN counts c ON r.count_id = c.id
      LEFT JOIN count_details cd ON r.count_detail_id = cd.id
      WHERE 1=1
    `
    let countQuery = 'SELECT COUNT(*) as total FROM requests r WHERE 1=1'
    const params: any[] = []

    if (filters.status) {
      query += ' AND r.status = ?'
      countQuery += ' AND r.status = ?'
      params.push(filters.status)
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

    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)

      // Si se resuelve (ajustado/rechazado), setear reviewed_at si no viene explícito.
      if ((data.status === 'ajustado' || data.status === 'rechazado') && data.reviewed_at === undefined) {
        updates.push('reviewed_at = NOW()')
      }
    }

    if (data.resolution_notes !== undefined) {
      updates.push('resolution_notes = ?')
      params.push(data.resolution_notes)
    }

    if (data.evidence_file !== undefined) {
      updates.push('evidence_file = ?')
      params.push(data.evidence_file)
    }

    if (data.reviewed_by_user_id !== undefined) {
      updates.push('reviewed_by_user_id = ?')
      params.push(data.reviewed_by_user_id)
    }

    if (data.reviewed_at !== undefined) {
      if (data.reviewed_at === 'NOW') {
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
    return updated
  }
}

export default RequestsService
