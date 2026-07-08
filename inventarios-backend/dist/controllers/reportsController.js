"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPriorityTimesReport = exports.getAdjustmentsReport = exports.getProductivityStats = exports.getLineStats = exports.getCoverageReport = exports.getCompanyOverview = exports.getAuditKPIs = void 0;
const ReportsService_1 = __importDefault(require("../services/ReportsService"));
const logger_1 = require("../utils/logger");
const getAuditKPIs = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const classification = req.query.classification;
        const responsibleUserId = req.query.responsible_user_id ? parseInt(req.query.responsible_user_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const kpis = await ReportsService_1.default.getAuditKPIs({
            branch_id: branchId,
            classification,
            responsible_user_id: responsibleUserId,
            date_from: dateFrom,
            date_to: dateTo
        });
        res.json(kpis);
    }
    catch (error) {
        logger_1.logger.error('Get Audit KPIs error:', error);
        res.status(500).json({ error: 'Failed to generate audit report' });
    }
};
exports.getAuditKPIs = getAuditKPIs;
const getCompanyOverview = async (req, res) => {
    try {
        const onlyActive = req.query.only_active === 'true';
        const overview = await ReportsService_1.default.getCompanyOverview({ only_active: onlyActive });
        res.json(overview);
    }
    catch (error) {
        logger_1.logger.error('Get Company Overview error:', error);
        res.status(500).json({ error: 'Failed to generate company overview' });
    }
};
exports.getCompanyOverview = getCompanyOverview;
const getCoverageReport = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const onlyActive = req.query.only_active === 'true';
        const report = await ReportsService_1.default.getCoverageReport(branchId, { only_active: onlyActive });
        res.json(report);
    }
    catch (error) {
        logger_1.logger.error('Get Coverage Report error:', error);
        res.status(500).json({ error: 'Failed to generate coverage report' });
    }
};
exports.getCoverageReport = getCoverageReport;
const getLineStats = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const stats = await ReportsService_1.default.getLineStats({
            branch_id: branchId,
            date_from: dateFrom,
            date_to: dateTo
        });
        res.json(stats);
    }
    catch (error) {
        logger_1.logger.error('Get Line Stats error:', error);
        res.status(500).json({ error: 'Failed to generate line stats' });
    }
};
exports.getLineStats = getLineStats;
const getProductivityStats = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const classification = req.query.classification;
        const responsibleUserId = req.query.responsible_user_id ? parseInt(req.query.responsible_user_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const stats = await ReportsService_1.default.getProductivityStats({
            branch_id: branchId,
            classification,
            responsible_user_id: responsibleUserId,
            date_from: dateFrom,
            date_to: dateTo
        });
        res.json(stats);
    }
    catch (error) {
        logger_1.logger.error('Get Productivity Stats error:', error);
        res.status(500).json({ error: 'Failed to generate productivity report' });
    }
};
exports.getProductivityStats = getProductivityStats;
const getAdjustmentsReport = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const report = await ReportsService_1.default.getAdjustmentsReport({
            branch_id: branchId,
            date_from: dateFrom,
            date_to: dateTo
        });
        res.json(report);
    }
    catch (error) {
        logger_1.logger.error('Get Adjustments Report error:', error);
        res.status(500).json({ error: 'Failed to generate adjustments report' });
    }
};
exports.getAdjustmentsReport = getAdjustmentsReport;
const getPriorityTimesReport = async (req, res) => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id) : undefined;
        const classification = req.query.classification;
        const responsibleUserId = req.query.responsible_user_id ? parseInt(req.query.responsible_user_id) : undefined;
        const dateFrom = req.query.date_from;
        const dateTo = req.query.date_to;
        const report = await ReportsService_1.default.getPriorityTimesReport({
            branch_id: branchId,
            classification,
            responsible_user_id: responsibleUserId,
            date_from: dateFrom,
            date_to: dateTo
        });
        res.json(report);
    }
    catch (error) {
        logger_1.logger.error('Get Priority Times Report error:', error);
        res.status(500).json({ error: 'Failed to generate priority times report' });
    }
};
exports.getPriorityTimesReport = getPriorityTimesReport;
exports.default = { getAuditKPIs: exports.getAuditKPIs, getCompanyOverview: exports.getCompanyOverview, getCoverageReport: exports.getCoverageReport, getLineStats: exports.getLineStats, getProductivityStats: exports.getProductivityStats, getAdjustmentsReport: exports.getAdjustmentsReport, getPriorityTimesReport: exports.getPriorityTimesReport };
//# sourceMappingURL=reportsController.js.map