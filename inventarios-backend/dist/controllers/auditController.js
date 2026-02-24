"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogs = void 0;
const AuditService_1 = __importDefault(require("../services/AuditService"));
const logger_1 = require("../utils/logger");
const listAuditLogs = async (req, res) => {
    try {
        const userId = req.query.user_id ? parseInt(req.query.user_id) : undefined;
        const entityType = req.query.entity_type;
        const entityId = req.query.entity_id ? parseInt(req.query.entity_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const result = await AuditService_1.default.list({
            user_id: userId,
            entity_type: entityType,
            entity_id: entityId,
            date_from: dateFrom,
            date_to: dateTo,
            limit,
            offset
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('List Audit Logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
};
exports.listAuditLogs = listAuditLogs;
exports.default = { listAuditLogs: exports.listAuditLogs };
//# sourceMappingURL=auditController.js.map