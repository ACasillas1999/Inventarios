export type RequestStatus = 'pendiente' | 'en_revision' | 'ajustado' | 'rechazado';
export type RequestRow = {
    id: number;
    folio: string;
    count_id: number;
    count_detail_id: number;
    branch_id: number;
    item_code: string;
    system_stock: number;
    counted_stock: number;
    difference: number;
    status: RequestStatus;
    requested_by_user_id: number;
    reviewed_by_user_id: number | null;
    reviewed_at: string | null;
    resolution_notes: string | null;
    evidence_file: string | null;
    created_at: string;
    updated_at: string;
};
export declare class RequestsService {
    private pool;
    getById(id: number): Promise<RequestRow | null>;
    listRequests(filters: {
        status?: RequestStatus;
        branch_id?: number;
        count_id?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        requests: RequestRow[];
        total: number;
    }>;
    updateRequest(id: number, data: {
        status?: RequestStatus;
        resolution_notes?: string | null;
        evidence_file?: string | null;
        reviewed_by_user_id?: number | null;
        reviewed_at?: 'NOW' | string | null;
    }): Promise<RequestRow>;
}
export default RequestsService;
//# sourceMappingURL=RequestsService.d.ts.map