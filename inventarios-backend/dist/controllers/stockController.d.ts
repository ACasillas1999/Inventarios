import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
/**
 * Obtiene la existencia de un artículo en una sucursal
 * GET /api/stock/:branchId/:itemCode
 */
export declare const getStock: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene las existencias de múltiples artículos en una sucursal
 * POST /api/stock/:branchId/batch
 * Body: { itemCodes: string[] }
 */
export declare const getBatchStock: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene las existencias de un artículo en todas las sucursales
 * GET /api/stock/all/:itemCode
 */
export declare const getStockAllBranches: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Compara stock del sistema vs stock contado
 * POST /api/stock/compare
 * Body: StockCompareRequest
 */
export declare const compareStock: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene información completa de un artículo
 * GET /api/stock/:branchId/item/:itemCode
 */
export declare const getItemInfo: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Busca artículos en una sucursal
 * GET /api/stock/:branchId/items?search=xxx&linea=yyy&limit=50&offset=0
 */
export declare const searchItems: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Invalida el caché de un artículo o sucursal
 * DELETE /api/stock/cache/:branchId/:itemCode?
 */
export declare const invalidateCache: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene las líneas/familias disponibles en el catálogo de una sucursal
 * GET /api/stock/:branchId/lines
 */
export declare const getLines: (req: AuthRequest, res: Response) => Promise<void>;
/**
 * Obtiene los códigos de artículos de una sucursal (opcionalmente filtrado por línea)
 * GET /api/stock/:branchId/item-codes?linea=xxx
 */
export declare const getItemCodes: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    getStock: (req: AuthRequest, res: Response) => Promise<void>;
    getBatchStock: (req: AuthRequest, res: Response) => Promise<void>;
    getStockAllBranches: (req: AuthRequest, res: Response) => Promise<void>;
    compareStock: (req: AuthRequest, res: Response) => Promise<void>;
    getItemInfo: (req: AuthRequest, res: Response) => Promise<void>;
    searchItems: (req: AuthRequest, res: Response) => Promise<void>;
    invalidateCache: (req: AuthRequest, res: Response) => Promise<void>;
    getLines: (req: AuthRequest, res: Response) => Promise<void>;
    getItemCodes: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=stockController.d.ts.map