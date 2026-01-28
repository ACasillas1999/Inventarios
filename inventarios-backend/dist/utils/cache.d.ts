import NodeCache from 'node-cache';
/**
 * CacheService - Sistema de caché en memoria para optimizar consultas
 * a bases de datos de sucursales
 */
export declare class CacheService {
    private static instance;
    private cache;
    private constructor();
    static getInstance(): CacheService;
    /**
     * Genera una clave de caché para existencias
     */
    private getStockKey;
    /**
     * Genera una clave de caché para artículos
     */
    private getItemKey;
    /**
     * Genera una clave de caché para artículos de sucursal
     */
    private getBranchItemsKey;
    /**
     * Obtiene el stock de un artículo desde caché
     */
    getStock(branchId: number, itemCode: string): number | undefined;
    /**
     * Guarda el stock de un artículo en caché
     */
    setStock(branchId: number, itemCode: string, stock: number, ttl?: number): void;
    /**
     * Obtiene múltiples stocks desde caché
     */
    getMultipleStocks(branchId: number, itemCodes: string[]): Map<string, number | undefined>;
    /**
     * Guarda múltiples stocks en caché
     */
    setMultipleStocks(branchId: number, stocks: Map<string, number>, ttl?: number): void;
    /**
     * Obtiene un artículo desde caché
     */
    getItem<T = any>(itemCode: string): T | undefined;
    /**
     * Guarda un artículo en caché
     */
    setItem<T = any>(itemCode: string, item: T, ttl?: number): void;
    /**
     * Obtiene artículos de una sucursal desde caché
     */
    getBranchItems<T = any>(branchId: number, filters?: string): T[] | undefined;
    /**
     * Guarda artículos de una sucursal en caché
     */
    setBranchItems<T = any>(branchId: number, items: T[], filters?: string, ttl?: number): void;
    /**
     * Invalida el caché de stock de un artículo específico
     */
    invalidateStock(branchId: number, itemCode: string): void;
    /**
     * Invalida todo el caché de stock de una sucursal
     */
    invalidateBranchStock(branchId: number): void;
    /**
     * Invalida el caché de artículos de una sucursal
     */
    invalidateBranchItems(branchId: number): void;
    /**
     * Invalida todo el caché de una sucursal
     */
    invalidateBranch(branchId: number): void;
    /**
     * Obtiene estadísticas del caché
     */
    getStats(): NodeCache.Stats;
    /**
     * Limpia todo el caché
     */
    flushAll(): void;
    /**
     * Obtiene una clave genérica del caché
     */
    get<T>(key: string): T | undefined;
    /**
     * Guarda una clave genérica en el caché
     */
    set<T>(key: string, value: T, ttl?: number): boolean;
    /**
     * Elimina una clave del caché
     */
    delete(key: string): number;
    /**
     * Verifica si una clave existe en caché
     */
    has(key: string): boolean;
}
export default CacheService;
//# sourceMappingURL=cache.d.ts.map