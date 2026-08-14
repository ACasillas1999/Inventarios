"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadCommentAttachment = exports.createComment = exports.listComments = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const server_1 = require("../websocket/server");
const InAppNotificationsService_1 = require("../services/InAppNotificationsService");
const upload_1 = require("../middlewares/upload");
const listComments = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        if (!Number.isFinite(requestId) || requestId <= 0) {
            res.status(400).json({ error: 'Invalid request ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute(`SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              rc.attachment_original_name, rc.attachment_mime_type, rc.attachment_size_bytes,
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
    const file = req.file;
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
        if (!message && !file) {
            res.status(400).json({ error: 'Message or attachment is required' });
            return;
        }
        if (message.length > 2000) {
            res.status(400).json({ error: 'Message too long (max 2000 chars)' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        // Verify request exists
        const [reqRows] = await pool.execute('SELECT id, folio FROM requests WHERE id = ?', [requestId]);
        if (!reqRows.length) {
            res.status(404).json({ error: 'Request not found' });
            return;
        }
        const [result] = await pool.execute(`INSERT INTO request_comments
        (request_id, user_id, message, attachment_original_name, attachment_stored_name, attachment_mime_type, attachment_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            requestId,
            userId,
            message,
            file ? file.originalname : null,
            file ? file.filename : null,
            file ? file.mimetype : null,
            file ? file.size : null
        ]);
        const newId = result.insertId;
        const [newRows] = await pool.execute(`SELECT rc.id, rc.request_id, rc.user_id, rc.message, rc.created_at,
              rc.attachment_original_name, rc.attachment_mime_type, rc.attachment_size_bytes,
              u.name AS user_name
       FROM request_comments rc
       LEFT JOIN users u ON u.id = rc.user_id
       WHERE rc.id = ?`, [newId]);
        const comment = newRows[0];
        // Emit via WebSocket to the request room
        (0, server_1.emitRequestComment)(requestId, comment);
        const recipients = await InAppNotificationsService_1.inAppNotificationsService.getRequestRecipients(requestId, userId);
        await InAppNotificationsService_1.inAppNotificationsService.notify(recipients, {
            actor_user_id: userId,
            type: 'request_comment',
            entity_type: 'request',
            entity_id: requestId,
            title: `Nuevo mensaje en ${reqRows[0].folio}`,
            body: message ? message.slice(0, 140) : `Adjuntó un archivo: ${file?.originalname ?? ''}`,
            link: `/solicitudes?open=${requestId}`
        });
        res.status(201).json(comment);
    }
    catch (error) {
        logger_1.logger.error('Create comment error:', error);
        if (file)
            fs_1.default.unlink(file.path, () => undefined);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};
exports.createComment = createComment;
const downloadCommentAttachment = async (req, res) => {
    try {
        const requestId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!Number.isFinite(requestId) || requestId <= 0 || !Number.isFinite(commentId) || commentId <= 0) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute('SELECT attachment_original_name, attachment_stored_name FROM request_comments WHERE id = ? AND request_id = ?', [commentId, requestId]);
        if (!rows.length || !rows[0].attachment_stored_name) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }
        const filePath = path_1.default.join(upload_1.CHAT_UPLOADS_DIR_PATH, rows[0].attachment_stored_name);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found on disk' });
            return;
        }
        res.download(filePath, rows[0].attachment_original_name);
    }
    catch (error) {
        logger_1.logger.error('Download comment attachment error:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
};
exports.downloadCommentAttachment = downloadCommentAttachment;
exports.default = { listComments: exports.listComments, createComment: exports.createComment, downloadCommentAttachment: exports.downloadCommentAttachment };
//# sourceMappingURL=commentsController.js.map