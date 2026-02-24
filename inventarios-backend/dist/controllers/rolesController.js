"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRolePermissions = exports.getRole = exports.listRoles = void 0;
const RolesService_1 = __importDefault(require("../services/RolesService"));
const logger_1 = require("../utils/logger");
const rolesService = new RolesService_1.default();
const listRoles = async (_req, res) => {
    try {
        const roles = await rolesService.getAll();
        res.json(roles);
    }
    catch (error) {
        logger_1.logger.error('List roles error:', error);
        res.status(500).json({ error: 'Failed to list roles' });
    }
};
exports.listRoles = listRoles;
const getRole = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const role = await rolesService.getById(roleId);
        if (!role) {
            res.status(404).json({ error: 'Role not found' });
            return;
        }
        res.json(role);
    }
    catch (error) {
        logger_1.logger.error('Get role error:', error);
        res.status(500).json({ error: 'Failed to get role' });
    }
};
exports.getRole = getRole;
const updateRolePermissions = async (req, res) => {
    try {
        const roleId = parseInt(req.params.id);
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            res.status(400).json({ error: 'Permissions must be an array of strings' });
            return;
        }
        const success = await rolesService.updatePermissions(roleId, permissions);
        if (!success) {
            res.status(404).json({ error: 'Role not found' });
            return;
        }
        res.json({ message: 'Permissions updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Update role permissions error:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
};
exports.updateRolePermissions = updateRolePermissions;
exports.default = { listRoles: exports.listRoles, getRole: exports.getRole, updateRolePermissions: exports.updateRolePermissions };
//# sourceMappingURL=rolesController.js.map