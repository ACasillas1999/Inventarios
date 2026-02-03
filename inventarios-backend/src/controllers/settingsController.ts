import { Request, Response } from 'express'
import { settingsService } from '../services/SettingsService'
import { logger } from '../utils/logger'

export class SettingsController {
    /**
     * Obtiene todas las configuraciones
     */
    async getAll(_req: Request, res: Response) {
        try {
            const settings = await settingsService.getAllSettings()
            return res.json(settings)
        } catch (error) {
            logger.error('Error getting settings:', error)
            return res.status(500).json({ error: 'Error al obtener las configuraciones' })
        }
    }

    /**
     * Obtiene una configuración específica
     */
    async getByKey(req: Request, res: Response) {
        try {
            const { key } = req.params
            const setting = await settingsService.getSetting(key)
            if (!setting) {
                return res.status(404).json({ error: 'Configuración no encontrada' })
            }
            return res.json(setting)
        } catch (error) {
            logger.error(`Error getting setting ${req.params.key}:`, error)
            return res.status(500).json({ error: 'Error al obtener la configuración' })
        }
    }

    /**
     * Actualiza una o más configuraciones
     */
    async update(req: Request, res: Response) {
        try {
            const { settings } = req.body
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ error: 'Se requiere un objeto de configuraciones' })
            }

            await settingsService.updateMultipleSettings(settings)
            return res.json({ message: 'Configuraciones actualizadas correctamente' })
        } catch (error) {
            logger.error('Error updating settings:', error)
            return res.status(500).json({ error: 'Error al actualizar las configuraciones' })
        }
    }
}

export const settingsController = new SettingsController()
