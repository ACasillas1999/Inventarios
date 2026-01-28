import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
/**
 * Crea un nuevo conteo
 * POST /api/counts
 */
export declare const createCount: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene un conteo por ID
 * GET /api/counts/:id
 */
export declare const getCount: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene un conteo por folio
 * GET /api/counts/folio/:folio
 */
export declare const getCountByFolio: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Lista conteos con filtros
 * GET /api/counts?branch_id=1&status=pendiente&...
 */
export declare const listCounts: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Actualiza un conteo
 * PUT /api/counts/:id
 */
export declare const updateCount: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Crea solicitudes de ajuste a partir de un conteo cerrado
 * POST /api/counts/:id/requests
 */
export declare const createRequestsFromCount: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene los detalles de un conteo
 * GET /api/counts/:id/details
 */
export declare const getCountDetails: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Agrega un detalle al conteo
 * POST /api/counts/:id/details
 */
export declare const addCountDetail: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Actualiza un detalle de conteo
 * PUT /api/counts/details/:id
 */
export declare const updateCountDetail: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene estadísticas del dashboard
 * GET /api/counts/stats/dashboard
 */
export declare const getDashboardStats: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Lista diferencias de conteos
 * GET /api/counts/differences
 */
export declare const listDifferences: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Elimina un conteo
 * DELETE /api/counts/:id
 */
export declare const deleteCount: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    createCount: (req: AuthRequest, res: Response) => Promise<void>;
    getCount: (req: AuthRequest, res: Response) => Promise<void>;
    getCountByFolio: (req: AuthRequest, res: Response) => Promise<void>;
    listCounts: (req: AuthRequest, res: Response) => Promise<void>;
    updateCount: (req: AuthRequest, res: Response) => Promise<void>;
    createRequestsFromCount: (req: AuthRequest, res: Response) => Promise<void>;
    getCountDetails: (req: AuthRequest, res: Response) => Promise<void>;
    addCountDetail: (req: AuthRequest, res: Response) => Promise<void>;
    updateCountDetail: (req: AuthRequest, res: Response) => Promise<void>;
    getDashboardStats: (req: AuthRequest, res: Response) => Promise<void>;
    listDifferences: (req: AuthRequest, res: Response) => Promise<void>;
    deleteCount: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=countsController.d.ts.map