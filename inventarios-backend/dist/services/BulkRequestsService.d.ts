export type BulkRequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado';
export type BulkRequestFileRow = {
    id: number;
    bulk_request_id: number;
    original_name: string;
    stored_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
};
export type BulkRequestRow = {
    id: number;
    folio: string;
    branch_id: number;
    branch_name?: string;
    warehouse_id: number;
    warehouse_name: string | null;
    classification: 'ajuste';
    priority: string;
    responsible_user_id: number;
    responsible_name?: string;
    requested_by_user_id: number;
    requested_by_name?: string;
    notes: string;
    status: BulkRequestStatus;
    movement_number: string | null;
    resolution_notes: string | null;
    reviewed_by_user_id: number | null;
    reviewed_by_name?: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
    files?: BulkRequestFileRow[];
};
export declare class BulkRequestsService {
    private pool;
    private generateFolio;
    getById(id: number): Promise<BulkRequestRow | null>;
    listRequests(filters: {
        status?: BulkRequestStatus;
        statuses?: BulkRequestStatus[];
        branch_id?: number;
        branch_ids?: number[];
        requested_by_user_id?: number;
        priority?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        requests: BulkRequestRow[];
        total: number;
    }>;
    create(data: {
        branch_id: number;
        warehouse_id: number;
        warehouse_name?: string | null;
        priority: string;
        responsible_user_id: number;
        requested_by_user_id: number;
        notes: string;
        files: Array<{
            original_name: string;
            stored_name: string;
            mime_type: string | null;
            size_bytes: number;
        }>;
    }): Promise<BulkRequestRow>;
    updateStatus(id: number, data: {
        status: BulkRequestStatus;
        movement_number?: string | null;
        resolution_notes?: string | null;
        reviewed_by_user_id: number;
    }): Promise<BulkRequestRow>;
}
export declare const bulkRequestsService: BulkRequestsService;
export default BulkRequestsService;
//# sourceMappingURL=BulkRequestsService.d.ts.map