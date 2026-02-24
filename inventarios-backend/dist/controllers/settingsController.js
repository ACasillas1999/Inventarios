"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = exports.SettingsController = void 0;
const SettingsService_1 = require("../services/SettingsService");
const logger_1 = require("../utils/logger");
class SettingsController {
    /**
     * Obtiene todas las configuraciones
     */
    async getAll(_req, res) {
        try {
            const settings = await SettingsService_1.settingsService.getAllSettings();
            return res.json(settings);
        }
        catch (error) {
            logger_1.logger.error('Error getting settings:', error);
            return res.status(500).json({ error: 'Error al obtener las configuraciones' });
        }
    }
    /**
     * Obtiene una configuración específica
     */
    async getByKey(req, res) {
        try {
            const { key } = req.params;
            const setting = await SettingsService_1.settingsService.getSetting(key);
            if (!setting) {
                return res.status(404).json({ error: 'Configuración no encontrada' });
            }
            return res.json(setting);
        }
        catch (error) {
            logger_1.logger.error(`Error getting setting ${req.params.key}:`, error);
            return res.status(500).json({ error: 'Error al obtener la configuración' });
        }
    }
    /**
     * Actualiza una o más configuraciones
     */
    async update(req, res) {
        try {
            const { settings } = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ error: 'Se requiere un objeto de configuraciones' });
            }
            await SettingsService_1.settingsService.updateMultipleSettings(settings);
            return res.json({ message: 'Configuraciones actualizadas correctamente' });
        }
        catch (error) {
            logger_1.logger.error('Error updating settings:', error);
            return res.status(500).json({ error: 'Error al actualizar las configuraciones' });
        }
    }
}
exports.SettingsController = SettingsController;
exports.settingsController = new SettingsController();
//# sourceMappingURL=settingsController.js.map