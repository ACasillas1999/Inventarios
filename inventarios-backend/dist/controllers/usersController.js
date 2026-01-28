"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeUserPassword = exports.updateUserStatus = exports.createUser = exports.listUsers = void 0;
const UsersService_1 = __importDefault(require("../services/UsersService"));
const logger_1 = require("../utils/logger");
const usersService = new UsersService_1.default();
const listUsers = async (req, res) => {
    try {
        const users = await usersService.getAll();
        res.json(users);
    }
    catch (error) {
        logger_1.logger.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
};
exports.listUsers = listUsers;
const createUser = async (req, res) => {
    try {
        const { name, email, password, role_id, branch_id, branch_ids } = req.body;
        // Validation
        if (!name || !email || !password) {
            res.status(400).json({ error: 'Name, email, and password are required' });
            return;
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }
        // Check if email already exists
        const existingUsers = await usersService.getAll();
        if (existingUsers.some(u => u.email === email)) {
            res.status(409).json({ error: 'User with this email already exists' });
            return;
        }
        const userData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role_id,
            branch_id,
            branch_ids
        };
        const newUser = await usersService.create(userData);
        logger_1.logger.info(`User created: ${newUser.email} by ${req.user?.email}`);
        res.status(201).json(newUser);
    }
    catch (error) {
        logger_1.logger.error('Create user error:', error);
        // Handle duplicate email error
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'User with this email already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
};
exports.createUser = createUser;
const updateUserStatus = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { status } = req.body;
        if (!status || !['active', 'suspended', 'inactive'].includes(status)) {
            res.status(400).json({ error: 'Invalid status value' });
            return;
        }
        await usersService.updateStatus(userId, status);
        logger_1.logger.info(`User ${userId} status updated to ${status} by ${req.user?.email}`);
        res.json({ message: 'User status updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Update user status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
};
exports.updateUserStatus = updateUserStatus;
const changeUserPassword = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long' });
            return;
        }
        await usersService.changePassword(userId, newPassword);
        logger_1.logger.info(`User ${userId} password changed by ${req.user?.email}`);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        logger_1.logger.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};
exports.changeUserPassword = changeUserPassword;
exports.default = { listUsers: exports.listUsers, createUser: exports.createUser, updateUserStatus: exports.updateUserStatus, changeUserPassword: exports.changeUserPassword };
//# sourceMappingURL=usersController.js.map