"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const database_1 = require("../config/database");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class UsersService {
    pool = (0, database_1.getLocalPool)();
    async getAll() {
        const [rows] = await this.pool.execute(`SELECT id, name, email, role_id, status FROM users ORDER BY name ASC`);
        return rows;
    }
    async create(data) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
            // Insert user
            const [result] = await connection.execute(`INSERT INTO users (name, email, password, role_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`, [data.name, data.email, hashedPassword, data.role_id || 1]);
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
            // Fetch and return created user
            const [users] = await this.pool.execute(`SELECT id, name, email, role_id, status, created_at, updated_at, last_login
         FROM users WHERE id = ?`, [userId]);
            return users[0];
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    async updateStatus(userId, status) {
        await this.pool.execute(`UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?`, [status, userId]);
    }
    async changePassword(userId, newPassword) {
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await this.pool.execute(`UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`, [hashedPassword, userId]);
    }
}
exports.UsersService = UsersService;
exports.default = UsersService;
//# sourceMappingURL=UsersService.js.map