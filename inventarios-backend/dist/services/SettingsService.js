"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = exports.SettingsService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
class SettingsService {
    pool = (0, database_1.getLocalPool)();
    /**
     * Obtiene todas las configuraciones
     */
    async getAllSettings() {
        const [rows] = await this.pool.execute('SELECT * FROM settings ORDER BY setting_key ASC');
        return rows;
    }
    /**
     * Obtiene una configuración por su clave
     */
    async getSetting(key) {
        const [rows] = await this.pool.execute('SELECT * FROM settings WHERE setting_key = ?', [key]);
        if (rows.length === 0)
            return null;
        return rows[0];
    }
    /**
     * Obtiene el valor de una configuración (ya casteado)
     */
    async getSettingValue(key, defaultValue) {
        const setting = await this.getSetting(key);
        if (!setting)
            return defaultValue;
        switch (setting.setting_type) {
            case 'number':
                return Number(setting.setting_value);
            case 'boolean':
                return (setting.setting_value === 'true' || setting.setting_value === '1');
            case 'json':
                try {
                    return JSON.parse(setting.setting_value);
                }
                catch {
                    return setting.setting_value;
                }
            default:
                return setting.setting_value;
        }
    }
    /**
     * Actualiza una configuración
     */
    async updateSetting(key, value) {
        const [result] = await this.pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
        if (result.affectedRows === 0) {
            // Si no existe, podríamos insertarla, pero por ahora lanzamos error
            // ya que esperamos que las llaves básicas existan por el schema.sql
            throw new Error(`Setting with key "${key}" not found`);
        }
        logger_1.logger.info(`Setting updated: ${key} = ${value}`);
    }
    /**
     * Actualiza múltiples configuraciones a la vez
     */
    async updateMultipleSettings(settings) {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const [key, value] of Object.entries(settings)) {
                await conn.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
            }
            await conn.commit();
        }
        catch (err) {
            await conn.rollback();
            throw err;
        }
        finally {
            conn.release();
        }
    }
}
exports.SettingsService = SettingsService;
exports.settingsService = new SettingsService();
//# sourceMappingURL=SettingsService.js.map