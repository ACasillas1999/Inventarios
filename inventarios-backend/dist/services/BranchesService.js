"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchesService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
/**
 * BranchesService - Servicio para gestionar sucursales en la base de datos local
 */
class BranchesService {
    pool = (0, database_1.getLocalPool)();
    /**
     * Obtiene todas las sucursales de la base de datos local
     */
    async getAllBranches() {
        const [rows] = await this.pool.execute('SELECT * FROM branches ORDER BY code');
        return rows;
    }
    /**
     * Obtiene una sucursal por ID
     */
    async getBranchById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM branches WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Obtiene una sucursal por código
     */
    async getBranchByCode(code) {
        const [rows] = await this.pool.execute('SELECT * FROM branches WHERE code = ?', [code]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Crea una nueva sucursal
     */
    async createBranch(data) {
        const query = `
      INSERT INTO branches (
        code, name, db_host, db_port, db_user, db_password, db_database, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const [result] = await this.pool.execute(query, [
            data.code,
            data.name,
            data.db_host,
            data.db_port,
            data.db_user,
            data.db_password,
            data.db_password, // Idealmente encriptado
            data.db_database,
            data.status || 'active'
        ]);
        const branch = await this.getBranchById(result.insertId);
        if (!branch) {
            throw new Error('Failed to create branch');
        }
        logger_1.logger.info(`Branch created: ${data.code} - ${data.name}`);
        return branch;
    }
    /**
     * Actualiza una sucursal
     */
    async updateBranch(id, data) {
        const updates = [];
        const params = [];
        if (data.code !== undefined) {
            updates.push('code = ?');
            params.push(data.code);
        }
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.db_host !== undefined) {
            updates.push('db_host = ?');
            params.push(data.db_host);
        }
        if (data.db_port !== undefined) {
            updates.push('db_port = ?');
            params.push(data.db_port);
        }
        if (data.db_user !== undefined) {
            updates.push('db_user = ?');
            params.push(data.db_user);
        }
        if (data.db_password !== undefined) {
            updates.push('db_password = ?');
            params.push(data.db_password);
        }
        if (data.db_database !== undefined) {
            updates.push('db_database = ?');
            params.push(data.db_database);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            params.push(data.status);
        }
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        params.push(id);
        const query = `UPDATE branches SET ${updates.join(', ')} WHERE id = ?`;
        await this.pool.execute(query, params);
        const branch = await this.getBranchById(id);
        if (!branch) {
            throw new Error('Branch not found after update');
        }
        logger_1.logger.info(`Branch ${id} updated`);
        return branch;
    }
    /**
     * Actualiza el estado de conexión de una sucursal
     */
    async updateConnectionStatus(id, status, connectionStatus, errorMessage) {
        await this.pool.execute(`UPDATE branches
       SET status = ?, connection_status = ?, last_connection_check = NOW()
       WHERE id = ?`, [status, connectionStatus, id]);
        logger_1.logger.debug(`Branch ${id} connection status updated: ${connectionStatus}`);
    }
    /**
     * Elimina una sucursal
     */
    async deleteBranch(id) {
        await this.pool.execute('DELETE FROM branches WHERE id = ?', [id]);
        logger_1.logger.info(`Branch ${id} deleted`);
    }
    /**
     * Convierte las sucursales de la BD a formato BranchDbConfig
     * Para usar con ConnectionManager
     */
    async getBranchesAsConfig() {
        const branches = await this.getAllBranches();
        return branches
            .filter((branch) => branch.status === 'active')
            .map((branch) => ({
            id: branch.id,
            code: branch.code,
            name: branch.name,
            host: branch.db_host,
            port: branch.db_port,
            user: branch.db_user,
            password: branch.db_password,
            database: branch.db_database,
            poolMax: 5
        }));
    }
    /**
     * Prueba la conexión a una sucursal
     */
    async testConnection(id) {
        try {
            const branch = await this.getBranchById(id);
            if (!branch) {
                return { success: false, message: 'Branch not found' };
            }
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: branch.db_host,
                port: branch.db_port,
                user: branch.db_user,
                password: branch.db_password,
                database: branch.db_database,
                connectTimeout: 5000
            });
            await connection.ping();
            await connection.end();
            await this.updateConnectionStatus(id, 'active', 'connected');
            return { success: true, message: 'Connection successful' };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.updateConnectionStatus(id, 'error', 'error', errorMessage);
            return { success: false, message: errorMessage };
        }
    }
}
exports.BranchesService = BranchesService;
exports.default = BranchesService;
//# sourceMappingURL=BranchesService.js.map