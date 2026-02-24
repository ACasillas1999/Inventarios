"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBaseSettings = ensureBaseSettings;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
/**
 * Asegura que las configuraciones base existan en la tabla settings
 */
async function ensureBaseSettings() {
    const pool = (0, database_1.getLocalPool)();
    const baseSettings = [
        { key: 'folio_format', value: 'CNT-{YEAR}{MONTH}-{NUMBER}', type: 'string', desc: 'Formato de folio de conteos (Soportados: {YEAR}, {MONTH}, {DAY}, {NUMBER})' },
        { key: 'pagination_limit', value: '50', type: 'number', desc: 'Registros por página por defecto' },
        { key: 'timezone', value: 'America/Mexico_City', type: 'string', desc: 'Zona horaria para timestamps' },
        { key: 'db_default_host', value: 'localhost', type: 'string', desc: 'Host por defecto para nuevas sucursales' },
        { key: 'db_default_user', value: 'root', type: 'string', desc: 'Usuario por defecto para bases de datos de sucursal' },
        { key: 'db_default_password', value: '', type: 'string', desc: 'Password por defecto para bases de datos de sucursal' },
        { key: 'db_default_name', value: '', type: 'string', desc: 'Prefijo o nombre de base de datos base' }
    ];
    try {
        for (const s of baseSettings) {
            await pool.execute(`INSERT IGNORE INTO settings (setting_key, setting_value, setting_type, description)
         VALUES (?, ?, ?, ?)`, [s.key, s.value, s.type, s.desc]);
        }
        logger_1.logger.info('Base settings verified/inserted');
    }
    catch (err) {
        logger_1.logger.error('Error ensuring base settings:', err);
    }
}
//# sourceMappingURL=initSettings.js.map