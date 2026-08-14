"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationsReadForEntity = exports.markAllNotificationsRead = exports.markNotificationRead = exports.listNotifications = void 0;
const InAppNotificationsService_1 = require("../services/InAppNotificationsService");
const logger_1 = require("../utils/logger");
const listNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const result = await InAppNotificationsService_1.inAppNotificationsService.list(userId, 30);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('List notifications error:', error);
        res.status(500).json({ error: 'Failed to list notifications' });
    }
};
exports.listNotifications = listNotifications;
const markNotificationRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            res.status(400).json({ error: 'Invalid notification ID' });
            return;
        }
        await InAppNotificationsService_1.inAppNotificationsService.markRead(userId, id);
        res.json({ message: 'ok' });
    }
    catch (error) {
        logger_1.logger.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification read' });
    }
};
exports.markNotificationRead = markNotificationRead;
const markAllNotificationsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        await InAppNotificationsService_1.inAppNotificationsService.markAllRead(userId);
        res.json({ message: 'ok' });
    }
    catch (error) {
        logger_1.logger.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications read' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
const markNotificationsReadForEntity = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const entityType = req.body?.entity_type;
        const entityId = Number(req.body?.entity_id);
        if ((entityType !== 'request' && entityType !== 'bulk_request') ||
            !Number.isFinite(entityId) ||
            entityId <= 0) {
            res.status(400).json({ error: 'Invalid entity_type or entity_id' });
            return;
        }
        await InAppNotificationsService_1.inAppNotificationsService.markReadForEntity(userId, entityType, entityId);
        res.json({ message: 'ok' });
    }
    catch (error) {
        logger_1.logger.error('Mark notifications read for entity error:', error);
        res.status(500).json({ error: 'Failed to mark notifications read' });
    }
};
exports.markNotificationsReadForEntity = markNotificationsReadForEntity;
exports.default = {
    listNotifications: exports.listNotifications,
    markNotificationRead: exports.markNotificationRead,
    markAllNotificationsRead: exports.markAllNotificationsRead,
    markNotificationsReadForEntity: exports.markNotificationsReadForEntity
};
//# sourceMappingURL=notificationsController.js.map