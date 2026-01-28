"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountsService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const ConnectionManager_1 = require("../connections/ConnectionManager");
/**
 * CountsService - Servicio para gestionar conteos en la base de datos local
 */
class CountsService {
    pool = (0, database_1.getLocalPool)();
    connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
    MAX_ITEMS_PER_COUNT = 10000;
    SEED_CHUNK_SIZE = 250;
    MAX_REQUESTS_PER_BATCH = 5000;
    /**
     * Genera un folio único para el conteo
     */
    async generateFolio() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        // Obtener el último número de folio del mes
        const [rows] = await this.pool.execute(`SELECT folio FROM counts
       WHERE folio LIKE ?
       ORDER BY id DESC LIMIT 1`, [`CNT-${year}${month}-%`]);
        let number = 1;
        if (rows.length > 0) {
            const lastFolio = rows[0].folio;
            const match = lastFolio.match(/-(\d+)$/);
            if (match) {
                number = parseInt(match[1]) + 1;
            }
        }
        return `CNT-${year}${month}-${String(number).padStart(4, '0')}`;
    }
    /**
     * Genera folios únicos para solicitudes (requests)
     */
    async generateRequestFolios(amount) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const [rows] = await this.pool.execute(`SELECT folio FROM requests
       WHERE folio LIKE ?
       ORDER BY id DESC LIMIT 1`, [`REQ-${year}${month}-%`]);
        let number = 1;
        if (rows.length > 0) {
            const lastFolio = rows[0].folio;
            const match = lastFolio.match(/-(\d+)$/);
            if (match) {
                number = parseInt(match[1]) + 1;
            }
        }
        const folios = [];
        for (let i = 0; i < amount; i++) {
            folios.push(`REQ-${year}${month}-${String(number + i).padStart(4, '0')}`);
        }
        return folios;
    }
    /**
     * Crea solicitudes de ajuste a partir de un conteo cerrado
     */
    async createRequestsFromCount(countId, requestedByUserId) {
        const count = await this.getCountById(countId);
        if (!count) {
            throw new Error('Count not found');
        }
        if (count.status !== 'cerrado' && count.status !== 'terminado') {
            throw new Error('Count must be closed');
        }
        const [diffRows] = await this.pool.execute(`
      SELECT
        cd.id as count_detail_id,
        cd.item_code,
        cd.system_stock,
        cd.counted_stock,
        (cd.counted_stock - cd.system_stock) as difference
      FROM count_details cd
      WHERE cd.count_id = ?
        AND cd.counted_stock IS NOT NULL
        AND cd.counted_stock != cd.system_stock
      ORDER BY cd.item_code ASC
      `, [countId]);
        const differences = diffRows;
        if (differences.length === 0) {
            return { created: 0, skipped: 0, total_differences: 0 };
        }
        if (differences.length > this.MAX_REQUESTS_PER_BATCH) {
            throw new Error(`Too many differences (${differences.length}).`);
        }
        // Evitar duplicados: si ya existe request para ese detail, lo saltamos
        const [existingRows] = await this.pool.execute(`SELECT count_detail_id FROM requests WHERE count_id = ?`, [countId]);
        const existingSet = new Set(existingRows.map((r) => Number(r.count_detail_id)));
        const toCreate = differences.filter((d) => !existingSet.has(d.count_detail_id));
        if (toCreate.length === 0) {
            return { created: 0, skipped: differences.length, total_differences: differences.length };
        }
        const folios = await this.generateRequestFolios(toCreate.length);
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const valuesSql = toCreate.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
            const sql = `
        INSERT INTO requests (
          folio, count_id, count_detail_id, branch_id, item_code,
          system_stock, counted_stock, difference, status, requested_by_user_id
        ) VALUES ${valuesSql}
      `;
            const params = [];
            toCreate.forEach((d, idx) => {
                params.push(folios[idx], countId, d.count_detail_id, count.branch_id, d.item_code, d.system_stock, d.counted_stock, d.difference, 'pendiente', requestedByUserId);
            });
            await conn.execute(sql, params);
            await conn.commit();
        }
        catch (err) {
            try {
                await conn.rollback();
            }
            catch {
                // ignore rollback error
            }
            throw err;
        }
        finally {
            conn.release();
        }
        return {
            created: toCreate.length,
            skipped: differences.length - toCreate.length,
            total_differences: differences.length
        };
    }
    /**
     * Crea un nuevo conteo
     */
    async createCount(userId, data) {
        const folio = await this.generateFolio();
        const itemCodes = this.normalizeItemCodes(data.items);
        if (itemCodes.length > this.MAX_ITEMS_PER_COUNT) {
            throw new Error(`Too many items (${itemCodes.length}). Max allowed is ${this.MAX_ITEMS_PER_COUNT}.`);
        }
        const query = `
      INSERT INTO counts (
        folio, branch_id, type, priority, status,
        responsible_user_id, created_by_user_id, scheduled_date,
        notes, tolerance_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [result] = await conn.execute(query, [
                folio,
                data.branch_id,
                data.type,
                data.priority || 'media',
                'pendiente',
                data.responsible_user_id,
                userId,
                data.scheduled_date || null,
                data.notes || null,
                data.tolerance_percentage || 5.0
            ]);
            if (itemCodes.length > 0) {
                await this.seedCountDetailsFromItems(conn, result.insertId, data.branch_id, itemCodes);
            }
            await conn.commit();
            const count = await this.getCountById(result.insertId);
            if (!count) {
                throw new Error('Failed to create count');
            }
            logger_1.logger.info(`Count created: ${folio} by user ${userId} (items: ${itemCodes.length || 0})`);
            return count;
        }
        catch (err) {
            try {
                await conn.rollback();
            }
            catch {
                // ignore rollback error
            }
            throw err;
        }
        finally {
            conn.release();
        }
    }
    normalizeItemCodes(items) {
        if (!Array.isArray(items))
            return [];
        const set = new Set();
        for (const raw of items) {
            const code = (raw ?? '').toString().trim();
            if (!code)
                continue;
            set.add(code);
        }
        return Array.from(set);
    }
    async seedCountDetailsFromItems(conn, countId, branchId, itemCodes) {
        const rowsToInsert = [];
        for (let i = 0; i < itemCodes.length; i += this.SEED_CHUNK_SIZE) {
            const chunk = itemCodes.slice(i, i + this.SEED_CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const articuloQuery = `
        SELECT
          Clave_Articulo as item_code,
          Descripcion as item_description,
          Unidad_Medida as unit
        FROM articulo
        WHERE Clave_Articulo IN (${placeholders})
      `;
            const stockQuery = `
        SELECT
          Clave_Articulo as item_code,
          SUM(Existencia_Fisica) as stock
        FROM articuloalm
        WHERE Clave_Articulo IN (${placeholders})
        GROUP BY Clave_Articulo
      `;
            let articuloRows = [];
            let stockRows = [];
            try {
                articuloRows = await this.connectionManager.executeQuery(branchId, articuloQuery, chunk);
            }
            catch (err) {
                if (err?.code === 'ER_NO_SUCH_TABLE') {
                    throw new Error(`Branch ${branchId} missing required tables articulo/articuloalm`);
                }
                throw err;
            }
            try {
                stockRows = await this.connectionManager.executeQuery(branchId, stockQuery, chunk);
            }
            catch (err) {
                if (err?.code === 'ER_NO_SUCH_TABLE') {
                    throw new Error(`Branch ${branchId} missing required tables articulo/articuloalm`);
                }
                throw err;
            }
            const infoByCode = new Map();
            for (const r of articuloRows)
                infoByCode.set(r.item_code, r);
            const stockByCode = new Map();
            for (const r of stockRows)
                stockByCode.set(r.item_code, Number(r.stock) || 0);
            for (const code of chunk) {
                const info = infoByCode.get(code);
                const systemStock = stockByCode.get(code) ?? 0;
                rowsToInsert.push({
                    item_code: code,
                    item_description: info?.item_description ?? null,
                    unit: info?.unit ?? null,
                    system_stock: systemStock
                });
            }
        }
        if (rowsToInsert.length === 0)
            return;
        for (let i = 0; i < rowsToInsert.length; i += this.SEED_CHUNK_SIZE) {
            const chunk = rowsToInsert.slice(i, i + this.SEED_CHUNK_SIZE);
            const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
            const insertSql = `
        INSERT INTO count_details (
          count_id, item_code, item_description, system_stock, counted_stock, unit
        ) VALUES ${valuesSql}
      `;
            const params = [];
            for (const row of chunk) {
                params.push(countId, row.item_code, row.item_description, row.system_stock, null, row.unit);
            }
            await conn.execute(insertSql, params);
        }
        logger_1.logger.info(`Seeded ${rowsToInsert.length} count_details for count ${countId}`);
    }
    /**
     * Obtiene un conteo por ID
     */
    async getCountById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM counts WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Obtiene un conteo por folio
     */
    async getCountByFolio(folio) {
        const [rows] = await this.pool.execute('SELECT * FROM counts WHERE folio = ?', [folio]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Lista conteos con filtros
     */
    async listCounts(filters) {
        let query = 'SELECT * FROM counts WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM counts WHERE 1=1';
        const params = [];
        if (filters.branch_id) {
            query += ' AND branch_id = ?';
            countQuery += ' AND branch_id = ?';
            params.push(filters.branch_id);
        }
        if (filters.status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.type) {
            query += ' AND type = ?';
            countQuery += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.responsible_user_id) {
            query += ' AND responsible_user_id = ?';
            countQuery += ' AND responsible_user_id = ?';
            params.push(filters.responsible_user_id);
        }
        if (filters.date_from) {
            query += ' AND created_at >= ?';
            countQuery += ' AND created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            query += ' AND created_at <= ?';
            countQuery += ' AND created_at <= ?';
            params.push(filters.date_to);
        }
        query += ' ORDER BY created_at DESC';
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
            if (filters.offset) {
                query += ' OFFSET ?';
                params.push(filters.offset);
            }
        }
        const [counts] = await this.pool.execute(query, params);
        const [countResult] = await this.pool.execute(countQuery, params);
        return {
            counts: counts,
            total: countResult[0].total
        };
    }
    /**
     * Actualiza un conteo
     */
    async updateCount(id, data) {
        const existing = await this.getCountById(id);
        if (!existing) {
            throw new Error('Count not found');
        }
        const updates = [];
        const params = [];
        if (data.status !== undefined) {
            // Evitar que un conteo ya iniciado/cerrado pueda ser iniciado nuevamente
            if (data.status === 'en_proceso' && existing.status !== 'pendiente') {
                throw new Error('Count already started');
            }
            updates.push('status = ?');
            params.push(data.status);
            // Auto-establecer timestamps según el estado
            if (data.status === 'en_proceso' && !data.started_at) {
                updates.push('started_at = NOW()');
            }
            else if (data.status === 'terminado' && !data.finished_at) {
                updates.push('finished_at = NOW()');
            }
            else if (data.status === 'cerrado' && !data.closed_at) {
                updates.push('closed_at = NOW()');
            }
        }
        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }
        if (data.started_at) {
            updates.push('started_at = ?');
            params.push(data.started_at);
        }
        if (data.finished_at) {
            updates.push('finished_at = ?');
            params.push(data.finished_at);
        }
        if (data.closed_at) {
            updates.push('closed_at = ?');
            params.push(data.closed_at);
        }
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        params.push(id);
        const query = `UPDATE counts SET ${updates.join(', ')} WHERE id = ?`;
        await this.pool.execute(query, params);
        const count = await this.getCountById(id);
        if (!count) {
            throw new Error('Count not found after update');
        }
        logger_1.logger.info(`Count ${id} updated`);
        return count;
    }
    /**
     * Agrega un detalle al conteo
     */
    async addCountDetail(countId, userId, data) {
        const difference = data.counted_stock - data.system_stock;
        const differencePercentage = data.system_stock !== 0 ? (difference / data.system_stock) * 100 : difference !== 0 ? 100 : 0;
        const query = `
      INSERT INTO count_details (
        count_id, item_code, item_description, system_stock,
        counted_stock, difference, difference_percentage, unit, counted_by_user_id, counted_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
        const [result] = await this.pool.execute(query, [
            countId,
            data.item_code,
            data.item_description || null,
            data.system_stock,
            data.counted_stock,
            difference,
            differencePercentage,
            data.unit || null,
            userId,
            data.notes || null
        ]);
        const detail = await this.getCountDetailById(result.insertId);
        if (!detail) {
            throw new Error('Failed to create count detail');
        }
        logger_1.logger.info(`Count detail created for count ${countId}, item ${data.item_code}`);
        return detail;
    }
    /**
     * Obtiene un detalle por ID
     */
    async getCountDetailById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM count_details WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Obtiene todos los detalles de un conteo
     */
    async getCountDetails(countId) {
        const [rows] = await this.pool.execute('SELECT * FROM count_details WHERE count_id = ? ORDER BY item_code', [countId]);
        return rows;
    }
    /**
     * Actualiza un detalle de conteo
     */
    async updateCountDetail(id, data) {
        const existing = await this.getCountDetailById(id);
        if (!existing) {
            throw new Error('Count detail not found');
        }
        const difference = data.counted_stock - existing.system_stock;
        const differencePercentage = existing.system_stock !== 0
            ? (difference / existing.system_stock) * 100
            : difference !== 0
                ? 100
                : 0;
        const query = `
      UPDATE count_details
      SET counted_stock = ?, difference = ?, difference_percentage = ?, notes = ?, counted_at = NOW()
      WHERE id = ?
    `;
        await this.pool.execute(query, [
            data.counted_stock,
            difference,
            differencePercentage,
            data.notes || null,
            id
        ]);
        // Si ya no hay detalles pendientes, cerrar el conteo automáticamente
        try {
            const countId = existing.count_id;
            if (countId) {
                const [pendingRows] = await this.pool.execute(`SELECT COUNT(*) as pending
           FROM count_details
           WHERE count_id = ? AND counted_at IS NULL`, [countId]);
                const pending = Number(pendingRows?.[0]?.pending ?? 0);
                if (pending === 0) {
                    await this.pool.execute(`UPDATE counts
             SET status = 'cerrado', closed_at = NOW()
             WHERE id = ? AND status = 'en_proceso'`, [countId]);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('Auto-close count failed:', err);
        }
        const detail = await this.getCountDetailById(id);
        if (!detail) {
            throw new Error('Count detail not found after update');
        }
        logger_1.logger.info(`Count detail ${id} updated`);
        return detail;
    }
    /**
     * Obtiene estadísticas del dashboard
     */
    async getDashboardStats() {
        const [stats] = await this.pool.execute(`
      SELECT
        SUM(CASE WHEN status IN ('pendiente', 'en_proceso') THEN 1 ELSE 0 END) as open_counts,
        SUM(CASE WHEN status = 'pendiente' AND scheduled_date IS NOT NULL THEN 1 ELSE 0 END) as scheduled_counts,
        SUM(CASE WHEN status = 'cerrado' THEN 1 ELSE 0 END) as closed_counts,
        (SELECT COUNT(*) FROM requests WHERE status = 'pendiente') as pending_requests
      FROM counts
    `);
        return stats[0];
    }
    /**
     * Elimina un conteo (soft delete cambiando estado)
     */
    async deleteCount(id) {
        await this.pool.execute('DELETE FROM counts WHERE id = ?', [id]);
        logger_1.logger.info(`Count ${id} deleted`);
    }
    /**
     * Lista diferencias registradas en detalles de conteo
     */
    async listDifferences() {
        const [rows] = await this.pool.execute(`
      SELECT
        cd.*,
        c.folio,
        c.branch_id
      FROM count_details cd
      INNER JOIN counts c ON c.id = cd.count_id
      WHERE cd.counted_stock IS NOT NULL
        AND cd.counted_stock != cd.system_stock
      ORDER BY cd.updated_at DESC
      `);
        return rows;
    }
}
exports.CountsService = CountsService;
exports.default = CountsService;
//# sourceMappingURL=CountsService.js.map