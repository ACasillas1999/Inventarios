import { RowDataPacket } from 'mysql2/promise';
export interface AuditLogEntry {
    id?: number;
    user_id: number | null;
    action: string;
    entity_type: string;
    entity_id: number;
    old_values?: any;
    new_values?: any;
    ip_address?: string;
    user_agent?: string;
    created_at?: string;
    user_name?: string;
}
export declare class AuditService {
    private pool;
    constructor();
    /**
     * Registra una acción en la bitácora
     */
    log(data: {
        user_id: number | null;
        action: string;
        entity_type: string;
        entity_id: number;
        old_values?: any;
        new_values?: any;
        ip_address?: string;
        user_agent?: string;
    }): Promise<void>;
    /**
     * Lista los movimientos de la bitácora con filtros
     */
    list(filters: {
        branch_id?: number;
        user_id?: number;
        entity_type?: string;
        entity_id?: number;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: AuditLogEntry[] & RowDataPacket[];
        total: any;
    }>;
}
export declare const auditService: AuditService;
export default auditService;
//# sourceMappingURL=AuditService.d.ts.map