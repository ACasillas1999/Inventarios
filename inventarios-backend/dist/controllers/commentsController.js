"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComment = exports.listComments = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const server_1 = require("../websocket/server");
const listComments = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!Number.isFinite(requestId) || requestId <= 0) {
            res.status(400).json({ error: 'Invalid request ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute(`SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              u.name AS user_name
       FROM request_comments rc
       LEFT JOIN users u ON u.id = rc.user_id
       WHERE rc.request_id = ?
       ORDER BY rc.created_at ASC`, [requestId]);
        res.json({ comments: rows });
    }
    catch (error) {
        logger_1.logger.error('List comments error:', error);
        res.status(500).json({ error: 'Failed to list comments' });
    }
};
exports.listComments = listComments;
const createComment = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const requestId = Number(req.params.id);
        if (!Number.isFinite(requestId) || requestId <= 0) {
            res.status(400).json({ error: 'Invalid request ID' });
            return;
        }
        const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }
        if (message.length > 2000) {
            res.status(400).json({ error: 'Message too long (max 2000 chars)' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        // Verify request exists
        const [reqRows] = await pool.execute('SELECT id FROM requests WHERE id = ?', [requestId]);
        if (!reqRows.length) {
            res.status(404).json({ error: 'Request not found' });
            return;
        }
        const [result] = await pool.execute('INSERT INTO request_comments (request_id, user_id, message) VALUES (?, ?, ?)', [requestId, userId, message]);
        const newId = result.insertId;
        const [newRows] = await pool.execute(`SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              u.name AS user_name
       FROM request_comments rc
       LEFT JOIN users u ON u.id = rc.user_id
       WHERE rc.id = ?`, [newId]);
        const comment = newRows[0];
        // Emit via WebSocket to the request room
        (0, server_1.emitRequestComment)(requestId, comment);
        res.status(201).json(comment);
    }
    catch (error) {
        logger_1.logger.error('Create comment error:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};
exports.createComment = createComment;
exports.default = { listComments: exports.listComments, createComment: exports.createComment };
//# sourceMappingURL=commentsController.js.map