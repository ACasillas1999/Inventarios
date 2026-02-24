"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const database_1 = require("../config/database");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("../utils/logger");
class UsersService {
    pool = (0, database_1.getLocalPool)();
    async getAll() {
        const [rows] = await this.pool.execute(`SELECT u.id, u.name, u.email, u.role_id, u.status, u.phone_number, 
              r.display_name as role_name, r.name as role_slug
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.name ASC`);
        // Fetch branches for each user
        const users = rows;
        for (const user of users) {
            const [branches] = await this.pool.execute(`SELECT b.id, b.code, b.name 
         FROM branches b
         JOIN user_branches ub ON b.id = ub.branch_id
         WHERE ub.user_id = ?`, [user.id]);
            user.branches = branches;
        }
        return users;
    }
    async create(data) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
            // Insert user
            const [result] = await connection.execute(`INSERT INTO users (name, email, password, role_id, status, phone_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, NOW(), NOW())`, [data.name, data.email, hashedPassword, data.role_id || 1, data.phone_number || null]);
            const userId = result.insertId;
            // If branch_ids provided, insert into user_branches
            if (data.branch_ids && data.branch_ids.length > 0) {
                const values = data.branch_ids.map(branchId => [userId, branchId]);
                await connection.query(`INSERT INTO user_branches (user_id, branch_id) VALUES ?`, [values]);
            }
            // If single branch_id provided (legacy support)
            else if (data.branch_id) {
                await connection.execute(`INSERT INTO user_branches (user_id, branch_id) VALUES (?, ?)`, [userId, data.branch_id]);
            }
            await connection.commit();
            // Fetch and return created user with branches
            return this.getUserById(userId);
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async getUserById(id) {
        const [users] = await this.pool.execute(`SELECT u.id, u.name, u.email, u.role_id, u.status, u.phone_number, 
              r.display_name as role_name, r.name as role_slug,
              u.created_at, u.updated_at, u.last_login
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`, [id]);
        if (users.length === 0) {
            throw new Error(`User ${id} not found`);
        }
        const user = users[0];
        const [branches] = await this.pool.execute(`SELECT b.id, b.code, b.name 
       FROM branches b
       JOIN user_branches ub ON b.id = ub.branch_id
       WHERE ub.user_id = ?`, [id]);
        user.branches = branches;
        // Fetch subscriptions
        const [subs] = await this.pool.execute(`SELECT event_key, branch_id FROM notification_subscriptions WHERE user_id = ?`, [id]);
        user.subscriptions = subs;
        return user;
    }
    async updateStatus(userId, status) {
        await this.pool.execute(`UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?`, [status, userId]);
    }
    async changePassword(userId, newPassword) {
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await this.pool.execute(`UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`, [hashedPassword, userId]);
    }
    async update(id, data) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const updates = [];
            const params = [];
            if (data.name) {
                updates.push('name = ?');
                params.push(data.name);
            }
            if (data.email) {
                updates.push('email = ?');
                params.push(data.email);
            }
            if (data.password) {
                const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
                updates.push('password = ?');
                params.push(hashedPassword);
            }
            if (data.role_id) {
                updates.push('role_id = ?');
                params.push(data.role_id);
            }
            if (data.status) {
                updates.push('status = ?');
                params.push(data.status);
            }
            if (data.phone_number !== undefined) {
                updates.push('phone_number = ?');
                params.push(data.phone_number || null);
            }
            if (updates.length > 0) {
                params.push(id);
                const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
                await connection.execute(query, params);
            }
            // Update branches if provided
            if (data.branch_ids !== undefined) {
                logger_1.logger.info(`Updating branches for user ${id}:`, data.branch_ids);
                // Delete current
                await connection.execute('DELETE FROM user_branches WHERE user_id = ?', [id]);
                // Insert new
                if (data.branch_ids.length > 0) {
                    const values = data.branch_ids.map(branchId => [id, branchId]);
                    await connection.query('INSERT INTO user_branches (user_id, branch_id) VALUES ?', [values]);
                }
            }
            await connection.commit();
            return this.getUserById(id);
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async updateSubscriptions(userId, subscriptions) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Delete current
            await connection.execute('DELETE FROM notification_subscriptions WHERE user_id = ?', [userId]);
            // Insert new
            if (subscriptions.length > 0) {
                const values = subscriptions.map(s => [userId, s.event_key, s.branch_id]);
                await connection.query('INSERT INTO notification_subscriptions (user_id, event_key, branch_id) VALUES ?', [values]);
            }
            await connection.commit();
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
}
exports.UsersService = UsersService;
exports.default = UsersService;
//# sourceMappingURL=UsersService.js.map