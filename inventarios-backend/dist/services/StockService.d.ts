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
     * IMPORTANTE: Almacen = 1 representa la sucursal principal; otros números son bodegas
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
    searchItems(branchId: number, search?: string, linea?: string, limit?: number, offset?: number, almacen?: number): Promise<ItemFromBranch[]>;
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
     * Obtiene los almacenes disponibles en una sucursal
     */
    getWarehouses(branchId: number): Promise<Array<{
        almacen: number;
        nombre?: string;
    }>>;
    /**
     * Obtiene las líneas (familias) distintas del catálogo de una sucursal
     * IMPORTANTE: Las líneas se obtienen de los primeros 5 caracteres de Clave_Articulo
     */
    getLines(branchId: number): Promise<string[]>;
    /**
     * Obtiene las existencias de un artículo en TODOS los almacenes de una sucursal
     * Incluye información del artículo y detalles de cada almacén
     */
    getItemWarehousesStock(branchId: number, itemCode: string): Promise<{
        item_code: string;
        item_description: string;
        item_line: string;
        item_unit: string;
        total_stock: number;
        warehouses: Array<{
            warehouse_id: number;
            warehouse_name: string;
            stock: number;
            rack: string | null;
            avg_cost: number;
            min_stock: number | null;
            max_stock: number | null;
            reorder_point: number | null;
        }>;
    } | null>;
    /**
     * Obtiene los códigos de artículos para una sucursal (opcionalmente filtrado por línea)
     * Útil para "seleccionar todos" sin paginación.
     * IMPORTANTE: Las líneas se filtran por los primeros 5 caracteres de Clave_Articulo
     */
    getItemCodes(branchId: number, linea?: string): Promise<string[]>;
}
export default StockService;
//# sourceMappingURL=StockService.d.ts.map