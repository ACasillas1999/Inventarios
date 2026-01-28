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
    /**
     * Genera un folio único para el conteo
     */
    private generateFolio;
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
     * Crea un nuevo conteo
     */
    createCount(userId: number, data: CreateCountRequest): Promise<Count>;
    private normalizeItemCodes;
    private seedCountDetailsFromItems;
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
        type?: string;
        responsible_user_id?: number;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        counts: Count[];
        total: number;
    }>;
    /**
     * Actualiza un conteo
     */
    updateCount(id: number, data: UpdateCountRequest): Promise<Count>;
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
    updateCountDetail(id: number, data: UpdateCountDetailRequest): Promise<CountDetail>;
    /**
     * Obtiene estadísticas del dashboard
     */
    getDashboardStats(): Promise<{
        open_counts: number;
        scheduled_counts: number;
        pending_requests: number;
        closed_counts: number;
    }>;
    /**
     * Elimina un conteo (soft delete cambiando estado)
     */
    deleteCount(id: number): Promise<void>;
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