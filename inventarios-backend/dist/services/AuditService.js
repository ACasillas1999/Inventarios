"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class AuditService {
    pool;
    constructor() {
        this.pool = (0, database_1.getLocalPool)();
    }
    /**
     * Registra una acción en la bitácora
     */
    async log(data) {
        try {
            const query = `
                INSERT INTO audit_log 
                (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            await this.pool.execute(query, [
                data.user_id,
                data.action,
                data.entity_type,
                data.entity_id,
                data.old_values ? JSON.stringify(data.old_values) : null,
                data.new_values ? JSON.stringify(data.new_values) : null,
                data.ip_address || null,
                data.user_agent || null
            ]);
        }
        catch (error) {
            logger_1.logger.error('Error recording audit log:', error);
            // No lanzamos el error para no interrumpir el flujo principal
        }
    }
    /**
     * Lista los movimientos de la bitácora con filtros
     */
    async list(filters) {
        let query = `
            SELECT a.*, u.name as user_name
            FROM audit_log a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.user_id) {
            query += ' AND a.user_id = ?';
            params.push(filters.user_id);
        }
        if (filters.entity_type) {
            query += ' AND a.entity_type = ?';
            params.push(filters.entity_type);
        }
        if (filters.entity_id) {
            query += ' AND a.entity_id = ?';
            params.push(filters.entity_id);
        }
        if (filters.date_from) {
            query += ' AND a.created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            query += ' AND a.created_at <= ?';
            params.push(filters.date_to);
        }
        query += ' ORDER BY a.created_at DESC';
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await this.pool.execute(query, params);
        // Obtener total para paginación
        let totalQuery = 'SELECT COUNT(*) as total FROM audit_log a WHERE 1=1';
        const totalParams = [];
        if (filters.user_id) {
            totalQuery += ' AND a.user_id = ?';
            totalParams.push(filters.user_id);
        }
        if (filters.entity_type) {
            totalQuery += ' AND a.entity_type = ?';
            totalParams.push(filters.entity_type);
        }
        if (filters.entity_id) {
            totalQuery += ' AND a.entity_id = ?';
            totalParams.push(filters.entity_id);
        }
        if (filters.date_from) {
            totalQuery += ' AND a.created_at >= ?';
            totalParams.push(filters.date_from);
        }
        if (filters.date_to) {
            totalQuery += ' AND a.created_at <= ?';
            totalParams.push(filters.date_to);
        }
        const [totalRows] = await this.pool.execute(totalQuery, totalParams);
        return {
            logs: rows,
            total: totalRows[0].total
        };
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
exports.default = exports.auditService;
//# sourceMappingURL=AuditService.js.map