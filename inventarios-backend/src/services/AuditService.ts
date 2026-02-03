import { Pool, RowDataPacket } from 'mysql2/promise'
import { getLocalPool } from '../config/database'
import { logger } from '../utils/logger'

export interface AuditLogEntry {
    id?: number
    user_id: number | null
    action: string
    entity_type: string
    entity_id: number
    old_values?: any
    new_values?: any
    ip_address?: string
    user_agent?: string
    created_at?: string
    user_name?: string // Joined from users table
}

export class AuditService {
    private pool: Pool

    constructor() {
        this.pool = getLocalPool()
    }

    /**
     * Registra una acción en la bitácora
     */
    async log(data: {
        user_id: number | null
        action: string
        entity_type: string
        entity_id: number
        old_values?: any
        new_values?: any
        ip_address?: string
        user_agent?: string
    }): Promise<void> {
        try {
            const query = `
                INSERT INTO audit_log 
                (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
            await this.pool.execute(query, [
                data.user_id,
                data.action,
                data.entity_type,
                data.entity_id,
                data.old_values ? JSON.stringify(data.old_values) : null,
                data.new_values ? JSON.stringify(data.new_values) : null,
                data.ip_address || null,
                data.user_agent || null
            ])
        } catch (error) {
            logger.error('Error recording audit log:', error)
            // No lanzamos el error para no interrumpir el flujo principal
        }
    }

    /**
     * Lista los movimientos de la bitácora con filtros
     */
    async list(filters: {
        branch_id?: number
        user_id?: number
        entity_type?: string
        date_from?: string
        date_to?: string
        limit?: number
        offset?: number
    }) {
        let query = `
            SELECT a.*, u.name as user_name
            FROM audit_log a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `
        const params: any[] = []

        if (filters.user_id) {
            query += ' AND a.user_id = ?'
            params.push(filters.user_id)
        }

        if (filters.entity_type) {
            query += ' AND a.entity_type = ?'
            params.push(filters.entity_type)
        }

        if (filters.date_from) {
            query += ' AND a.created_at >= ?'
            params.push(filters.date_from)
        }

        if (filters.date_to) {
            query += ' AND a.created_at <= ?'
            params.push(filters.date_to)
        }

        query += ' ORDER BY a.created_at DESC'

        const limit = filters.limit || 50
        const offset = filters.offset || 0
        query += ' LIMIT ? OFFSET ?'
        params.push(limit, offset)

        const [rows] = await this.pool.execute<AuditLogEntry[] & RowDataPacket[]>(query, params)

        // Obtener total para paginación
        const [totalRows] = await this.pool.execute<any[]>(
            'SELECT COUNT(*) as total FROM audit_log WHERE 1=1',
            []
        )

        return {
            logs: rows,
            total: totalRows[0].total
        }
    }
}

export const auditService = new AuditService()
export default auditService
