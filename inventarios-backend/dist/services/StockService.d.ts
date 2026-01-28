import { ItemFromBranch, StockResponse } from '../types';
/**
 * StockService - Servicio para consultar existencias en las sucursales
 * Utiliza caché para optimizar las consultas repetidas
 */
export declare class StockService {
    private connectionManager;
    private cacheService;
    constructor();
    /**
     * Obtiene la existencia de un artículo en una sucursal
     * Intenta primero desde caché, luego consulta la BD
     */
    getStock(branchId: number, itemCode: string): Promise<number>;
    /**
     * Consulta la existencia directamente de la base de datos
     * Adaptado al esquema real: Tabla articuloalm con columnas Clave_Articulo y Existencia_Fisica
     */
    private queryStockFromDatabase;
    /**
     * Obtiene las existencias de múltiples artículos en una sucursal
     * Optimizado para consultas en paralelo
     */
    getBatchStock(branchId: number, itemCodes: string[]): Promise<Map<string, number>>;
    /**
     * Obtiene las existencias de un artículo en todas las sucursales
     * Ejecuta consultas en paralelo
     */
    getStockAllBranches(itemCode: string): Promise<StockResponse[]>;
    /**
     * Obtiene información completa de un artículo de una sucursal
     */
    getItemInfo(branchId: number, itemCode: string): Promise<ItemFromBranch | null>;
    /**
     * Busca artículos en una sucursal con filtros
     */
    searchItems(branchId: number, search?: string, linea?: string, limit?: number, offset?: number): Promise<ItemFromBranch[]>;
    /**
     * Invalida el caché de un artículo en una sucursal
     */
    invalidateCache(branchId: number, itemCode?: string): void;
    /**
     * Sincroniza las existencias de múltiples artículos
     * Útil para actualizar el caché
     */
    syncStocks(branchId: number, itemCodes: string[]): Promise<void>;
    /**
     * Obtiene las líneas (familias) distintas del catálogo de una sucursal
     */
    getLines(branchId: number): Promise<string[]>;
    /**
     * Obtiene los códigos de artículos para una sucursal (opcionalmente filtrado por línea)
     * Útil para "seleccionar todos" sin paginación.
     */
    getItemCodes(branchId: number, linea?: string): Promise<string[]>;
}
export default StockService;
//# sourceMappingURL=StockService.d.ts.map