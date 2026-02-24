"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialLinesService = exports.SpecialLinesService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const AuditService_1 = require("./AuditService");
/**
 * SpecialLinesService - Servicio para gestionar líneas especiales
 * que requieren monitoreo especial en conteos de inventario
 */
class SpecialLinesService {
    pool = (0, database_1.getLocalPool)();
    /**
     * Obtiene todas las líneas especiales
     */
    async getAll() {
        const [rows] = await this.pool.execute('SELECT * FROM special_lines ORDER BY line_code');
        return rows.map(this.parseSpecialLine);
    }
    /**
     * Obtiene solo las líneas activas
     */
    async getActive() {
        const [rows] = await this.pool.execute('SELECT * FROM special_lines WHERE is_active = TRUE ORDER BY line_code');
        return rows.map(this.parseSpecialLine);
    }
    /**
     * Obtiene una línea por ID
     */
    async getById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM special_lines WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        return this.parseSpecialLine(rows[0]);
    }
    /**
     * Obtiene una línea por código
     */
    async getByLineCode(lineCode) {
        const [rows] = await this.pool.execute('SELECT * FROM special_lines WHERE line_code = ?', [lineCode]);
        if (rows.length === 0) {
            return null;
        }
        return this.parseSpecialLine(rows[0]);
    }
    /**
     * Verifica si un artículo pertenece a una línea especial activa
     * @param itemCode Código del artículo
     * @returns Línea especial si pertenece, null si no
     */
    async checkItemBelongsToSpecialLine(itemCode) {
        if (!itemCode || itemCode.length < 5) {
            return null;
        }
        // Extraer los primeros 5 caracteres (código de línea)
        const lineCode = itemCode.substring(0, 5);
        const [rows] = await this.pool.execute('SELECT * FROM special_lines WHERE line_code = ? AND is_active = TRUE', [lineCode]);
        if (rows.length === 0) {
            return null;
        }
        return this.parseSpecialLine(rows[0]);
    }
    /**
     * Crea una nueva línea especial
     */
    async create(data, userId) {
        // Validar código de línea (debe ser exactamente 5 caracteres)
        if (!data.line_code || data.line_code.length !== 5) {
            throw new Error('El código de línea debe tener exactamente 5 caracteres');
        }
        // Verificar que no exista ya
        const existing = await this.getByLineCode(data.line_code);
        if (existing) {
            throw new Error(`Ya existe una línea especial con el código ${data.line_code}`);
        }
        const whatsappNumbersJson = data.whatsapp_numbers
            ? JSON.stringify(data.whatsapp_numbers)
            : null;
        const query = `
      INSERT INTO special_lines (
        line_code, line_name, tolerance_percentage, whatsapp_numbers, is_active
      ) VALUES (?, ?, ?, ?, ?)
    `;
        const [result] = await this.pool.execute(query, [
            data.line_code.toUpperCase(), // Normalizar a mayúsculas
            data.line_name || null,
            data.tolerance_percentage ?? 5.0,
            whatsappNumbersJson,
            data.is_active ?? true
        ]);
        const specialLine = await this.getById(result.insertId);
        if (!specialLine) {
            throw new Error('Error al crear la línea especial');
        }
        logger_1.logger.info(`Línea especial creada: ${data.line_code} - ${data.line_name}`);
        await AuditService_1.auditService.log({
            user_id: userId,
            action: 'CREATE_SPECIAL_LINE',
            entity_type: 'special_line',
            entity_id: specialLine.id,
            new_values: data
        });
        return specialLine;
    }
    /**
     * Actualiza una línea especial
     */
    async update(id, data, userId) {
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Línea especial no encontrada');
        }
        const updates = [];
        const params = [];
        if (data.line_name !== undefined) {
            updates.push('line_name = ?');
            params.push(data.line_name);
        }
        if (data.tolerance_percentage !== undefined) {
            updates.push('tolerance_percentage = ?');
            params.push(data.tolerance_percentage);
        }
        if (data.whatsapp_numbers !== undefined) {
            updates.push('whatsapp_numbers = ?');
            params.push(JSON.stringify(data.whatsapp_numbers));
        }
        if (data.is_active !== undefined) {
            updates.push('is_active = ?');
            params.push(data.is_active);
        }
        if (updates.length === 0) {
            throw new Error('No hay campos para actualizar');
        }
        params.push(id);
        const query = `UPDATE special_lines SET ${updates.join(', ')} WHERE id = ?`;
        await this.pool.execute(query, params);
        const specialLine = await this.getById(id);
        if (!specialLine) {
            throw new Error('Línea especial no encontrada después de actualizar');
        }
        logger_1.logger.info(`Línea especial ${id} actualizada`);
        await AuditService_1.auditService.log({
            user_id: userId,
            action: 'UPDATE_SPECIAL_LINE',
            entity_type: 'special_line',
            entity_id: id,
            old_values: existing,
            new_values: data
        });
        return specialLine;
    }
    /**
     * Elimina una línea especial
     */
    async delete(id, userId) {
        const existing = await this.getById(id);
        await this.pool.execute('DELETE FROM special_lines WHERE id = ?', [id]);
        logger_1.logger.info(`Línea especial ${id} eliminada`);
        await AuditService_1.auditService.log({
            user_id: userId,
            action: 'DELETE_SPECIAL_LINE',
            entity_type: 'special_line',
            entity_id: id,
            old_values: existing
        });
    }
    /**
     * Activa o desactiva una línea especial
     */
    async toggleActive(id, isActive, userId) {
        return this.update(id, { is_active: isActive }, userId);
    }
    /**
     * Parsea una fila de la base de datos a SpecialLine
     */
    parseSpecialLine(row) {
        return {
            id: row.id,
            line_code: row.line_code,
            line_name: row.line_name,
            tolerance_percentage: parseFloat(row.tolerance_percentage),
            whatsapp_numbers: row.whatsapp_numbers,
            is_active: Boolean(row.is_active),
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }
    /**
     * Obtiene los números de WhatsApp parseados como array
     */
    getWhatsAppNumbers(specialLine) {
        if (!specialLine.whatsapp_numbers) {
            return [];
        }
        try {
            const numbers = JSON.parse(specialLine.whatsapp_numbers);
            return Array.isArray(numbers) ? numbers : [];
        }
        catch (error) {
            logger_1.logger.error('Error parseando números de WhatsApp:', error);
            return [];
        }
    }
}
exports.SpecialLinesService = SpecialLinesService;
exports.specialLinesService = new SpecialLinesService();
exports.default = SpecialLinesService;
//# sourceMappingURL=SpecialLinesService.js.map