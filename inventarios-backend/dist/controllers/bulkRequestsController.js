"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadBulkCommentAttachment = exports.createBulkRequestComment = exports.listBulkRequestComments = exports.listBulkRequestFileDownloads = exports.downloadBulkRequestFile = exports.updateBulkRequestStatus = exports.createBulkRequest = exports.getBulkRequest = exports.listBulkRequests = void 0;
const fs_1 = __importDefault(require("fs"));
const BulkRequestsService_1 = __importDefault(require("../services/BulkRequestsService"));
const logger_1 = require("../utils/logger");
const database_1 = require("../config/database");
const upload_1 = require("../middlewares/upload");
const path_1 = __importDefault(require("path"));
const server_1 = require("../websocket/server");
const InAppNotificationsService_1 = require("../services/InAppNotificationsService");
const bulkRequestsService = new BulkRequestsService_1.default();
const parseNumber = (value) => {
    if (value === undefined || value === null || value === '')
        return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
};
const parseStatusQuery = (value) => {
    if (value === undefined || value === null || value === '')
        return [];
    if (Array.isArray(value)) {
        return value
            .flatMap((entry) => String(entry).split(','))
            .map((entry) => entry.trim())
            .filter(Boolean);
    }
    return String(value)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};
const ALLOWED_STATUSES = ['pendiente', 'en_revision', 'ajustado', 'rechazado'];
const listBulkRequests = async (req, res) => {
    try {
        const statusValues = parseStatusQuery(req.query.status);
        const invalidStatus = statusValues.find((value) => !ALLOWED_STATUSES.includes(value));
        if (invalidStatus) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        const statuses = statusValues;
        const status = statuses.length === 1 ? statuses[0] : undefined;
        const branch_id = parseNumber(req.query.branch_id);
        const limit = parseNumber(req.query.limit);
        const offset = parseNumber(req.query.offset);
        const userId = req.user?.id;
        const roleId = req.user?.role_id;
        if (!userId || !roleId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        let branch_ids = undefined;
        if (roleId === 2) {
            const pool = (0, database_1.getLocalPool)();
            const [rows] = await pool.execute('SELECT branch_id FROM user_branches WHERE user_id = ?', [userId]);
            branch_ids = rows.map((r) => r.branch_id);
        }
        const result = await bulkRequestsService.listRequests({
            status,
            statuses: statuses.length > 1 ? statuses : undefined,
            branch_id,
            branch_ids,
            priority: req.query.priority,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit,
            offset
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('List bulk requests error:', error);
        res.status(500).json({ error: 'Failed to list bulk requests' });
    }
};
exports.listBulkRequests = listBulkRequests;
const getBulkRequest = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid bulk request ID' });
            return;
        }
        const bulkRequest = await bulkRequestsService.getById(id);
        if (!bulkRequest) {
            res.status(404).json({ error: 'Bulk request not found' });
            return;
        }
        res.json(bulkRequest);
    }
    catch (error) {
        logger_1.logger.error('Get bulk request error:', error);
        res.status(500).json({ error: 'Failed to get bulk request' });
    }
};
exports.getBulkRequest = getBulkRequest;
const createBulkRequest = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const files = req.files || [];
        if (files.length === 0) {
            res.status(400).json({ error: 'Debes adjuntar al menos un archivo' });
            return;
        }
        const branch_id = parseNumber(req.body?.branch_id);
        const warehouse_id = parseNumber(req.body?.warehouse_id);
        const responsible_user_id = parseNumber(req.body?.responsible_user_id);
        const priority = req.body?.priority ? String(req.body.priority) : 'media';
        const notes = req.body?.notes !== undefined ? String(req.body.notes).trim() : '';
        const warehouse_name = req.body?.warehouse_name !== undefined ? String(req.body.warehouse_name) : undefined;
        if (!branch_id || !warehouse_id || !responsible_user_id || !notes) {
            for (const file of files) {
                fs_1.default.unlink(file.path, () => undefined);
            }
            res.status(400).json({ error: 'Sucursal, almacén, responsable y observaciones son obligatorios' });
            return;
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
        });
        res.status(201).json(created);
    }
    catch (error) {
        logger_1.logger.error('Create bulk request error:', error);
        const files = req.files || [];
        for (const file of files) {
            fs_1.default.unlink(file.path, () => undefined);
        }
        res.status(500).json({ error: 'Failed to create bulk request' });
    }
};
exports.createBulkRequest = createBulkRequest;
const updateBulkRequestStatus = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid bulk request ID' });
            return;
        }
        const statusRaw = req.body?.status !== undefined ? String(req.body.status) : undefined;
        if (!statusRaw || !ALLOWED_STATUSES.includes(statusRaw)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }
        const movement_number = req.body?.movement_number !== undefined ? String(req.body.movement_number).trim() : undefined;
        const resolution_notes = req.body?.resolution_notes !== undefined ? String(req.body.resolution_notes).trim() : undefined;
        const updated = await bulkRequestsService.updateStatus(id, {
            status: statusRaw,
            movement_number,
            resolution_notes,
            reviewed_by_user_id: userId
        });
        res.json(updated);
    }
    catch (error) {
        logger_1.logger.error('Update bulk request status error:', error);
        if (error instanceof Error && error.message === 'Bulk request not found') {
            res.status(404).json({ error: 'Bulk request not found' });
            return;
        }
        if (error instanceof Error && error.message === 'Invalid status transition') {
            res.status(400).json({ error: 'Transicion de estatus invalida' });
            return;
        }
        if (error instanceof Error && error.message === 'Movement number is required') {
            res.status(400).json({ error: 'El número de movimiento es obligatorio' });
            return;
        }
        if (error instanceof Error && error.message === 'Resolution notes are required') {
            res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
            return;
        }
        res.status(500).json({ error: 'Failed to update bulk request status' });
    }
};
exports.updateBulkRequestStatus = updateBulkRequestStatus;
const downloadBulkRequestFile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const id = Number(req.params.id);
        const fileId = Number(req.params.fileId);
        if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const bulkRequest = await bulkRequestsService.getById(id);
        if (!bulkRequest) {
            res.status(404).json({ error: 'Bulk request not found' });
            return;
        }
        const file = bulkRequest.files?.find((f) => f.id === fileId);
        if (!file) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        const filePath = path_1.default.join(upload_1.UPLOADS_DIR_PATH, file.stored_name);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found on disk' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        await pool.execute('INSERT INTO bulk_request_file_downloads (bulk_request_file_id, user_id) VALUES (?, ?)', [fileId, userId]);
        res.download(filePath, file.original_name);
    }
    catch (error) {
        logger_1.logger.error('Download bulk request file error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
};
exports.downloadBulkRequestFile = downloadBulkRequestFile;
const listBulkRequestFileDownloads = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const fileId = Number(req.params.fileId);
        if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(fileId) || fileId <= 0) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [fileRows] = await pool.execute('SELECT id FROM bulk_request_files WHERE id = ? AND bulk_request_id = ?', [fileId, id]);
        if (!fileRows.length) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        const [rows] = await pool.execute(`SELECT d.id, d.user_id, d.downloaded_at, u.name AS user_name
       FROM bulk_request_file_downloads d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.bulk_request_file_id = ?
       ORDER BY d.downloaded_at DESC`, [fileId]);
        res.json({ downloads: rows });
    }
    catch (error) {
        logger_1.logger.error('List bulk request file downloads error:', error);
        res.status(500).json({ error: 'Failed to list file downloads' });
    }
};
exports.listBulkRequestFileDownloads = listBulkRequestFileDownloads;
const listBulkRequestComments = async (req, res) => {
    try {
        const bulkRequestId = Number(req.params.id);
        if (!Number.isFinite(bulkRequestId) || bulkRequestId <= 0) {
            res.status(400).json({ error: 'Invalid bulk request ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute(`SELECT bc.id, bc.bulk_request_id, bc.user_id, bc.message, bc.created_at,
              bc.attachment_original_name, bc.attachment_mime_type, bc.attachment_size_bytes,
              u.name AS user_name
       FROM bulk_request_comments bc
       LEFT JOIN users u ON u.id = bc.user_id
       WHERE bc.bulk_request_id = ?
       ORDER BY bc.created_at ASC`, [bulkRequestId]);
        res.json({ comments: rows });
    }
    catch (error) {
        logger_1.logger.error('List bulk request comments error:', error);
        res.status(500).json({ error: 'Failed to list comments' });
    }
};
exports.listBulkRequestComments = listBulkRequestComments;
const createBulkRequestComment = async (req, res) => {
    const file = req.file;
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const bulkRequestId = Number(req.params.id);
        if (!Number.isFinite(bulkRequestId) || bulkRequestId <= 0) {
            res.status(400).json({ error: 'Invalid bulk request ID' });
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
        const [bulkRows] = await pool.execute('SELECT id, folio FROM bulk_requests WHERE id = ?', [bulkRequestId]);
        if (!bulkRows.length) {
            res.status(404).json({ error: 'Bulk request not found' });
            return;
        }
        const [result] = await pool.execute(`INSERT INTO bulk_request_comments
        (bulk_request_id, user_id, message, attachment_original_name, attachment_stored_name, attachment_mime_type, attachment_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            bulkRequestId,
            userId,
            message,
            file ? file.originalname : null,
            file ? file.filename : null,
            file ? file.mimetype : null,
            file ? file.size : null
        ]);
        const newId = result.insertId;
        const [newRows] = await pool.execute(`SELECT bc.id, bc.bulk_request_id, bc.user_id, bc.message, bc.created_at,
              bc.attachment_original_name, bc.attachment_mime_type, bc.attachment_size_bytes,
              u.name AS user_name
       FROM bulk_request_comments bc
       LEFT JOIN users u ON u.id = bc.user_id
       WHERE bc.id = ?`, [newId]);
        const comment = newRows[0];
        (0, server_1.emitBulkRequestComment)(bulkRequestId, comment);
        const recipients = await InAppNotificationsService_1.inAppNotificationsService.getBulkRequestRecipients(bulkRequestId, userId);
        await InAppNotificationsService_1.inAppNotificationsService.notify(recipients, {
            actor_user_id: userId,
            type: 'bulk_request_comment',
            entity_type: 'bulk_request',
            entity_id: bulkRequestId,
            title: `Nuevo mensaje en ${bulkRows[0].folio}`,
            body: message ? message.slice(0, 140) : `Adjuntó un archivo: ${file?.originalname ?? ''}`,
            link: `/solicitudes-masivas?open=${bulkRequestId}`
        });
        res.status(201).json(comment);
    }
    catch (error) {
        logger_1.logger.error('Create bulk request comment error:', error);
        if (file)
            fs_1.default.unlink(file.path, () => undefined);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};
exports.createBulkRequestComment = createBulkRequestComment;
const downloadBulkCommentAttachment = async (req, res) => {
    try {
        const bulkRequestId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!Number.isFinite(bulkRequestId) || bulkRequestId <= 0 ||
            !Number.isFinite(commentId) || commentId <= 0) {
            res.status(400).json({ error: 'Invalid ID' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [rows] = await pool.execute('SELECT attachment_original_name, attachment_stored_name FROM bulk_request_comments WHERE id = ? AND bulk_request_id = ?', [commentId, bulkRequestId]);
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
        logger_1.logger.error('Download bulk comment attachment error:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
};
exports.downloadBulkCommentAttachment = downloadBulkCommentAttachment;
exports.default = {
    listBulkRequests: exports.listBulkRequests,
    getBulkRequest: exports.getBulkRequest,
    createBulkRequest: exports.createBulkRequest,
    updateBulkRequestStatus: exports.updateBulkRequestStatus,
    downloadBulkRequestFile: exports.downloadBulkRequestFile,
    listBulkRequestFileDownloads: exports.listBulkRequestFileDownloads,
    listBulkRequestComments: exports.listBulkRequestComments,
    createBulkRequestComment: exports.createBulkRequestComment,
    downloadBulkCommentAttachment: exports.downloadBulkCommentAttachment
};
//# sourceMappingURL=bulkRequestsController.js.map