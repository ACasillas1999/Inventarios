import { Request, Response } from 'express';
export declare class SettingsController {
    /**
     * Obtiene todas las configuraciones
     */
    getAll(_req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Obtiene una configuración específica
     */
    getByKey(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Actualiza una o más configuraciones
     */
    update(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const settingsController: SettingsController;
//# sourceMappingURL=settingsController.d.ts.map