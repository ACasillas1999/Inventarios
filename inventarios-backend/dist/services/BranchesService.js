"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.branchesService = exports.BranchesService = void 0;
const database_1 = require("../config/database");
const ConnectionManager_1 = require("../connections/ConnectionManager");
class BranchesService {
    pool = (0, database_1.getLocalPool)();
    /**
     * Obtiene todas las sucursales directamente de la DB
     */
    async getAllFromDb() {
        const [rows] = await this.pool.execute('SELECT id, code, name, db_host, db_port, db_user, db_password, db_database, status FROM branches ORDER BY name ASC');
        return rows;
    }
    /**
     * Crea una nueva sucursal
     */
    async create(data) {
        const [result] = await this.pool.execute(`INSERT INTO branches (code, name, db_host, db_port, db_user, db_password, db_database, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            data.code,
            data.name,
            data.host,
            data.port || 3306,
            data.user,
            data.password,
            data.database,
            'active'
        ]);
        const newId = result.insertId;
        // Actualizar ConnectionManager dinámicamente
        const cm = ConnectionManager_1.ConnectionManager.getInstance();
        await cm.addBranch({
            id: newId,
            code: data.code,
            name: data.name,
            host: data.host,
            port: data.port || 3306,
            user: data.user,
            password: data.password,
            database: data.database
        });
        return newId;
    }
    /**
     * Actualiza una sucursal existente
     */
    async update(id, data) {
        const fields = [];
        const params = [];
        if (data.code) {
            fields.push('code = ?');
            params.push(data.code);
        }
        if (data.name) {
            fields.push('name = ?');
            params.push(data.name);
        }
        if (data.host) {
            fields.push('db_host = ?');
            params.push(data.host);
        }
        if (data.port) {
            fields.push('db_port = ?');
            params.push(data.port);
        }
        if (data.user) {
            fields.push('db_user = ?');
            params.push(data.user);
        }
        if (data.password) {
            fields.push('db_password = ?');
            params.push(data.password);
        }
        if (data.database) {
            fields.push('db_database = ?');
            params.push(data.database);
        }
        if (fields.length === 0)
            return;
        params.push(id);
        await this.pool.execute(`UPDATE branches SET ${fields.join(', ')} WHERE id = ?`, params);
        // Recargar la sucursal en el ConnectionManager
        const [rows] = await this.pool.execute('SELECT id, code, name, db_host as host, db_port as port, db_user as user, db_password as password, db_database as \`database\` FROM branches WHERE id = ?', [id]);
        if (rows.length > 0) {
            const config = rows[0];
            const cm = ConnectionManager_1.ConnectionManager.getInstance();
            await cm.addBranch(config);
        }
    }
    /**
     * Elimina una sucursal
     */
    async delete(id) {
        await this.pool.execute('DELETE FROM branches WHERE id = ?', [id]);
        // Eliminar del ConnectionManager
        const cm = ConnectionManager_1.ConnectionManager.getInstance();
        await cm.removeBranch(id);
    }
}
exports.BranchesService = BranchesService;
exports.branchesService = new BranchesService();
//# sourceMappingURL=BranchesService.js.map