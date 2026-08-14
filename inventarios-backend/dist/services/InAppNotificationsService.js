"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inAppNotificationsService = exports.InAppNotificationsService = void 0;
const database_1 = require("../config/database");
const server_1 = require("../websocket/server");
const logger_1 = require("../utils/logger");
class InAppNotificationsService {
    pool = (0, database_1.getLocalPool)();
    async getRequestRecipients(requestId, excludeUserId) {
        const [rows] = await this.pool.execute(`SELECT r.requested_by_user_id, r.reviewed_by_user_id, c.created_by_user_id, c.responsible_user_id
       FROM requests r
       LEFT JOIN counts c ON r.count_id = c.id
       WHERE r.id = ?
       LIMIT 1`, [requestId]);
        const row = rows[0];
        const ids = new Set();
        if (row) {
            ;
            [row.requested_by_user_id, row.reviewed_by_user_id, row.created_by_user_id, row.responsible_user_id].forEach((id) => {
                if (id)
                    ids.add(Number(id));
            });
        }
        const [commentRows] = await this.pool.execute('SELECT DISTINCT user_id FROM request_comments WHERE request_id = ?', [requestId]);
        commentRows.forEach((c) => ids.add(Number(c.user_id)));
        ids.delete(excludeUserId);
        return Array.from(ids);
    }
    async getBulkRequestRecipients(bulkRequestId, excludeUserId) {
        const [rows] = await this.pool.execute(`SELECT requested_by_user_id, responsible_user_id, reviewed_by_user_id
       FROM bulk_requests
       WHERE id = ?
       LIMIT 1`, [bulkRequestId]);
        const row = rows[0];
        const ids = new Set();
        if (row) {
            ;
            [row.requested_by_user_id, row.responsible_user_id, row.reviewed_by_user_id].forEach((id) => {
                if (id)
                    ids.add(Number(id));
            });
        }
        const [commentRows] = await this.pool.execute('SELECT DISTINCT user_id FROM bulk_request_comments WHERE bulk_request_id = ?', [bulkRequestId]);
        commentRows.forEach((c) => ids.add(Number(c.user_id)));
        ids.delete(excludeUserId);
        return Array.from(ids);
    }
    async notify(recipients, data) {
        if (!recipients.length)
            return;
        try {
            for (const userId of recipients) {
                const [result] = await this.pool.execute(`INSERT INTO notifications (user_id, actor_user_id, type, entity_type, entity_id, title, body, link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                    userId,
                    data.actor_user_id,
                    data.type,
                    data.entity_type,
                    data.entity_id,
                    data.title,
                    data.body || null,
                    data.link
                ]);
                const [rows] = await this.pool.execute(`SELECT n.*, u.name AS actor_name
           FROM notifications n
           LEFT JOIN users u ON u.id = n.actor_user_id
           WHERE n.id = ?`, [result.insertId]);
                if (rows[0]) {
                    (0, server_1.emitNotification)(userId, rows[0]);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error creating notifications:', error);
        }
    }
    async list(userId, limit = 30) {
        const [rows] = await this.pool.execute(`SELECT n.*, u.name AS actor_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`, [userId, limit]);
        const [countRows] = await this.pool.execute('SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
        return {
            notifications: rows,
            unread_count: Number(countRows[0]?.total ?? 0)
        };
    }
    async markRead(userId, id) {
        await this.pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    }
    async markAllRead(userId) {
        await this.pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
    }
    async markReadForEntity(userId, entityType, entityId) {
        await this.pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND is_read = 0', [userId, entityType, entityId]);
    }
}
exports.InAppNotificationsService = InAppNotificationsService;
exports.inAppNotificationsService = new InAppNotificationsService();
exports.default = InAppNotificationsService;
//# sourceMappingURL=InAppNotificationsService.js.map