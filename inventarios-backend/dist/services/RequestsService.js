"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestsService = void 0;
const database_1 = require("../config/database");
class RequestsService {
    pool = (0, database_1.getLocalPool)();
    async getById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM requests WHERE id = ?', [
            id
        ]);
        if (!rows.length)
            return null;
        return rows[0];
    }
    async listRequests(filters) {
        let query = 'SELECT * FROM requests WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM requests WHERE 1=1';
        const params = [];
        if (filters.status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.branch_id) {
            query += ' AND branch_id = ?';
            countQuery += ' AND branch_id = ?';
            params.push(filters.branch_id);
        }
        if (filters.count_id) {
            query += ' AND count_id = ?';
            countQuery += ' AND count_id = ?';
            params.push(filters.count_id);
        }
        query += ' ORDER BY created_at DESC';
        const limit = typeof filters.limit === 'number' ? filters.limit : 50;
        const offset = typeof filters.offset === 'number' ? filters.offset : 0;
        query += ' LIMIT ? OFFSET ?';
        const queryParams = [...params, limit, offset];
        const [rows] = await this.pool.execute(query, queryParams);
        const [countRows] = await this.pool.execute(countQuery, params);
        return {
            requests: rows,
            total: Number(countRows?.[0]?.total ?? 0)
        };
    }
    async updateRequest(id, data) {
        const existing = await this.getById(id);
        if (!existing)
            throw new Error('Request not found');
        const updates = [];
        const params = [];
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
            // Si se resuelve (ajustado/rechazado), setear reviewed_at si no viene explícito.
            if ((data.status === 'ajustado' || data.status === 'rechazado') && data.reviewed_at === undefined) {
                updates.push('reviewed_at = NOW()');
            }
        }
        if (data.resolution_notes !== undefined) {
            updates.push('resolution_notes = ?');
            params.push(data.resolution_notes);
        }
        if (data.evidence_file !== undefined) {
            updates.push('evidence_file = ?');
            params.push(data.evidence_file);
        }
        if (data.reviewed_by_user_id !== undefined) {
            updates.push('reviewed_by_user_id = ?');
            params.push(data.reviewed_by_user_id);
        }
        if (data.reviewed_at !== undefined) {
            if (data.reviewed_at === 'NOW') {
                updates.push('reviewed_at = NOW()');
            }
            else {
                updates.push('reviewed_at = ?');
                params.push(data.reviewed_at);
            }
        }
        if (!updates.length)
            throw new Error('No fields to update');
        params.push(id);
        await this.pool.execute(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);
        const updated = await this.getById(id);
        if (!updated)
            throw new Error('Request not found after update');
        return updated;
    }
}
exports.RequestsService = RequestsService;
exports.default = RequestsService;
//# sourceMappingURL=RequestsService.js.map