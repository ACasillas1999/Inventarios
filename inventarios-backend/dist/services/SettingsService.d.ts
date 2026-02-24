export interface Setting {
    id: number;
    setting_key: string;
    setting_value: string;
    setting_type: 'string' | 'number' | 'boolean' | 'json';
    description: string;
    created_at: Date;
    updated_at: Date;
}
export declare class SettingsService {
    private pool;
    /**
     * Obtiene todas las configuraciones
     */
    getAllSettings(): Promise<Setting[]>;
    /**
     * Obtiene una configuración por su clave
     */
    getSetting(key: string): Promise<Setting | null>;
    /**
     * Obtiene el valor de una configuración (ya casteado)
     */
    getSettingValue<T = any>(key: string, defaultValue?: T): Promise<T>;
    /**
     * Actualiza una configuración
     */
    updateSetting(key: string, value: string): Promise<void>;
    /**
     * Actualiza múltiples configuraciones a la vez
     */
    updateMultipleSettings(settings: Record<string, string>): Promise<void>;
}
export declare const settingsService: SettingsService;
//# sourceMappingURL=SettingsService.d.ts.map