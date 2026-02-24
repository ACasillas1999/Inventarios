"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserNotifications = exports.updateUser = exports.changeUserPassword = exports.updateUserStatus = exports.createUser = exports.listUsers = void 0;
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
        const { name, email, password, role_id, branch_id, branch_ids, phone_number } = req.body;
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
            branch_ids,
            phone_number
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
        let finalStatus = status;
        if (status === 'activo')
            finalStatus = 'active';
        if (status === 'suspendido')
            finalStatus = 'suspended';
        if (!['active', 'suspended', 'inactive'].includes(finalStatus)) {
            res.status(400).json({ error: 'Invalid status value' });
            return;
        }
        await usersService.updateStatus(userId, finalStatus);
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
const updateUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, email, password, role_id, branch_ids, phone_number, status } = req.body;
        const userData = {};
        if (name)
            userData.name = name.trim();
        if (email)
            userData.email = email.trim().toLowerCase();
        if (password)
            userData.password = password;
        if (role_id)
            userData.role_id = role_id;
        if (branch_ids)
            userData.branch_ids = branch_ids;
        if (phone_number !== undefined)
            userData.phone_number = phone_number;
        if (status)
            userData.status = status;
        const updatedUser = await usersService.update(userId, userData);
        logger_1.logger.info(`User updated: ${updatedUser.email} by ${req.user?.email}`);
        res.json(updatedUser);
    }
    catch (error) {
        logger_1.logger.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
const updateUserNotifications = async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { subscriptions } = req.body; // Array of { event_key: string, branch_id: number | null }
        if (!Array.isArray(subscriptions)) {
            res.status(400).json({ error: 'Subscriptions must be an array' });
            return;
        }
        await usersService.updateSubscriptions(userId, subscriptions);
        logger_1.logger.info(`User ${userId} notifications updated by ${req.user?.email}`);
        res.json({ message: 'Notifications updated successfully' });
    }
    catch (error) {
        logger_1.logger.error('Update notifications error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};
exports.updateUserNotifications = updateUserNotifications;
exports.default = { listUsers: exports.listUsers, createUser: exports.createUser, updateUserStatus: exports.updateUserStatus, changeUserPassword: exports.changeUserPassword, updateUser: exports.updateUser, updateUserNotifications: exports.updateUserNotifications };
//# sourceMappingURL=usersController.js.map