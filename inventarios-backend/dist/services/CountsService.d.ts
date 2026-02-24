import { Count, CountDetail, CreateCountRequest, UpdateCountRequest, CreateCountDetailRequest, UpdateCountDetailRequest } from '../types';
/**
 * CountsService - Servicio para gestionar conteos en la base de datos local
 */
export declare class CountsService {
    private pool;
    private connectionManager;
    private readonly MAX_ITEMS_PER_COUNT;
    private readonly SEED_CHUNK_SIZE;
    private readonly MAX_REQUESTS_PER_BATCH;
    private readonly HISTORY_CHUNK_SIZE;
    private getCountedItemCodesInRange;
    getItemsHistory(branchId: number, itemCodes: string[], from: string, to: string, almacen?: number): Promise<Array<{
        item_code: string;
        last_counted_at: string;
        count_id: number;
        folio: string;
        almacen: number;
    }>>;
    /**
     * Genera múltiples folios únicos secuenciales basados en la configuración
     */
    private generateMultipleFolios;
    /**
     * Genera folios únicos para solicitudes (requests)
     */
    private generateRequestFolios;
    /**
     * Crea solicitudes de ajuste a partir de un conteo cerrado
     */
    createRequestsFromCount(countId: number, requestedByUserId: number): Promise<{
        created: number;
        skipped: number;
        total_differences: number;
    }>;
    /**
     * Valida que no existan conteos activos con los mismos códigos de artículo
     */
    private validateNoDuplicateActiveCounts;
    /**
     * Crea múltiples conteos - uno por cada artículo en el almacén seleccionado
     */
    createCount(userId: number, data: CreateCountRequest): Promise<Count[]>;
    private normalizeItemCodes;
    private seedCountDetailsFromItems;
    private seedCountDetailsWithValues;
    /**
     * Obtiene un conteo por ID
     */
    getCountById(id: number): Promise<Count | null>;
    /**
     * Obtiene un conteo por folio
     */
    getCountByFolio(folio: string): Promise<Count | null>;
    /**
     * Lista conteos con filtros
     */
    listCounts(filters: {
        branch_id?: number;
        status?: string;
        statuses?: string[];
        type?: string;
        classification?: string;
        responsible_user_id?: number;
        date_from?: string;
        date_to?: string;
        scheduled_from?: string;
        scheduled_to?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        counts: Count[];
        total: number;
    }>;
    /**
     * Refresca el stock de sistema desde el ERP para todos los artículos en un conteo
     */
    private refreshStocksForCount;
    /**
     * Actualiza un conteo
     */
    updateCount(id: number, data: UpdateCountRequest, userId: number): Promise<Count>;
    /**
     * Helper para notificar asignación/reasignación
     */
    private notifyAssignment;
    /**
     * Verifica si hay artículos de líneas especiales con diferencias significativas
     * y envía notificaciones por WhatsApp
     */
    private checkSpecialLinesAndNotify;
    /**
     * Agrega un detalle al conteo
     */
    addCountDetail(countId: number, userId: number, data: CreateCountDetailRequest): Promise<CountDetail>;
    /**
     * Obtiene un detalle por ID
     */
    getCountDetailById(id: number): Promise<CountDetail | null>;
    /**
     * Obtiene todos los detalles de un conteo
     */
    getCountDetails(countId: number): Promise<CountDetail[]>;
    /**
     * Actualiza un detalle de conteo
     */
    updateCountDetail(id: number, data: UpdateCountDetailRequest, userId: number): Promise<CountDetail>;
    /**
     * Obtiene estadísticas del dashboard
     * Devuelve contadores globales, resumen por sucursal y conteos recientes
     */
    getDashboardStats(): Promise<any>;
    /**
     * Elimina un conteo (soft delete cambiando estado)
     */
    deleteCount(id: number, userId: number): Promise<void>;
    /**
     * Lista diferencias registradas en detalles de conteo
     */
    listDifferences(): Promise<Array<CountDetail & {
        folio: string;
        branch_id: number;
    }>>;
}
export default CountsService;
//# sourceMappingURL=CountsService.d.ts.map