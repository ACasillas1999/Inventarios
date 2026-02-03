import { getLocalPool } from '../config/database'
import { logger } from '../utils/logger'
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export interface Setting {
    id: number
    setting_key: string
    setting_value: string
    setting_type: 'string' | 'number' | 'boolean' | 'json'
    description: string
    created_at: Date
    updated_at: Date
}

export class SettingsService {
    private pool = getLocalPool()

    /**
     * Obtiene todas las configuraciones
     */
    async getAllSettings(): Promise<Setting[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            'SELECT * FROM settings ORDER BY setting_key ASC'
        )
        return rows as Setting[]
    }

    /**
     * Obtiene una configuración por su clave
     */
    async getSetting(key: string): Promise<Setting | null> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            'SELECT * FROM settings WHERE setting_key = ?',
            [key]
        )
        if (rows.length === 0) return null
        return rows[0] as Setting
    }

    /**
     * Obtiene el valor de una configuración (ya casteado)
     */
    async getSettingValue<T = any>(key: string, defaultValue?: T): Promise<T> {
        const setting = await this.getSetting(key)
        if (!setting) return defaultValue as T

        switch (setting.setting_type) {
            case 'number':
                return Number(setting.setting_value) as any
            case 'boolean':
                return (setting.setting_value === 'true' || setting.setting_value === '1') as any
            case 'json':
                try {
                    return JSON.parse(setting.setting_value)
                } catch {
                    return setting.setting_value as any
                }
            default:
                return setting.setting_value as any
        }
    }

    /**
     * Actualiza una configuración
     */
    async updateSetting(key: string, value: string): Promise<void> {
        const [result] = await this.pool.execute<ResultSetHeader>(
            'UPDATE settings SET setting_value = ? WHERE setting_key = ?',
            [value, key]
        )

        if (result.affectedRows === 0) {
            // Si no existe, podríamos insertarla, pero por ahora lanzamos error
            // ya que esperamos que las llaves básicas existan por el schema.sql
            throw new Error(`Setting with key "${key}" not found`)
        }

        logger.info(`Setting updated: ${key} = ${value}`)
    }

    /**
     * Actualiza múltiples configuraciones a la vez
     */
    async updateMultipleSettings(settings: Record<string, string>): Promise<void> {
        const conn = await this.pool.getConnection()
        try {
            await conn.beginTransaction()
            for (const [key, value] of Object.entries(settings)) {
                await conn.execute(
                    'UPDATE settings SET setting_value = ? WHERE setting_key = ?',
                    [value, key]
                )
            }
            await conn.commit()
        } catch (err) {
            await conn.rollback()
            throw err
        } finally {
            conn.release()
        }
    }
}

export const settingsService = new SettingsService()
