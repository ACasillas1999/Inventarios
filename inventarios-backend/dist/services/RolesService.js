"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const database_1 = require("../config/database");
class RolesService {
    pool = (0, database_1.getLocalPool)();
    async getAll() {
        const [rows] = await this.pool.execute(`SELECT id, name, display_name, description, permissions, created_at, updated_at 
       FROM roles ORDER BY id ASC`);
        return rows.map(row => ({
            ...row,
            permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
        }));
    }
    async getById(id) {
        const [rows] = await this.pool.execute(`SELECT id, name, display_name, description, permissions, created_at, updated_at 
       FROM roles WHERE id = ?`, [id]);
        if (rows.length === 0)
            return null;
        const role = rows[0];
        return {
            ...role,
            permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
        };
    }
    async updatePermissions(id, permissions) {
        const [result] = await this.pool.execute('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), id]);
        return result.affectedRows > 0;
    }
}
exports.RolesService = RolesService;
exports.default = RolesService;
//# sourceMappingURL=RolesService.js.map