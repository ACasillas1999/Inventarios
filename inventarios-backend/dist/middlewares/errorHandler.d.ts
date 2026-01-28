import { Request, Response, NextFunction } from 'express';
export interface ApiError extends Error {
    status?: number;
    code?: string;
}
/**
 * Middleware para manejo centralizado de errores
 */
export declare const errorHandler: (err: ApiError, req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware para rutas no encontradas
 */
export declare const notFoundHandler: (req: Request, res: Response) => void;
/**
 * Crea un error de API con código de estado
 */
export declare const createError: (message: string, status?: number, code?: string) => ApiError;
export default errorHandler;
//# sourceMappingURL=errorHandler.d.ts.map