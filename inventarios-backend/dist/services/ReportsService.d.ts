import { RowDataPacket } from 'mysql2/promise';
export interface KPIStats {
    avg_assignment_time: string;
    avg_start_time: string;
    avg_resolution_time: string;
    efficiency_by_user: any[];
    assignment_by_user: any[];
    resolution_by_user: any[];
}
export interface CoverageItem {
    id: string | number;
    name: string;
    total_items: number;
    counted_items: number;
    percentage: number;
    children?: CoverageItem[];
}
export interface CompanyOverview {
    total_items: number;
    counted_items: number;
    coverage_percentage: number;
    branch_stats: {
        name: string;
        percentage: number;
    }[];
}
export declare class ReportsService {
    private pool;
    /**
     * Obtiene métricas de auditoría y tiempos de respuesta
     */
    getAuditKPIs(filters: {
        branch_id?: number;
        classification?: string;
        responsible_user_id?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<KPIStats>;
    /**
     * Obtiene una vista general de la empresa
     */
    getCompanyOverview(filters?: {
        only_active?: boolean;
    }): Promise<CompanyOverview>;
    /**
     * Obtiene el reporte de cobertura jerárquico
     */
    getCoverageReport(branchId?: number, filters?: {
        only_active?: boolean;
    }): Promise<CoverageItem[]>;
    /**
     * Estadísticas de líneas (Más contadas y con mayor diferencia)
     */
    getLineStats(filters: {
        branch_id?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<{
        topCounted: {
            name: any;
            value: any;
        }[];
        topDiff: {
            name: any;
            value: any;
        }[];
    }>;
    /**
     * Obtiene estadísticas de productividad por usuario
     */
    getProductivityStats(filters: {
        branch_id?: number;
        classification?: string;
        responsible_user_id?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<{
        topSurtidores: any[] | RowDataPacket[];
        topSolicitantes: any[] | RowDataPacket[];
        topRevisores: any[] | RowDataPacket[];
    }>;
    /**
     * Obtiene el reporte de ajustes (diferencias) valorizadas
     */
    getAdjustmentsReport(filters: {
        branch_id?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<any[]>;
    /**
     * Obtiene el reporte de tiempos de respuesta por prioridad
     */
    getPriorityTimesReport(filters: {
        branch_id?: number;
        classification?: string;
        responsible_user_id?: number;
        date_from?: string;
        date_to?: string;
    }): Promise<{
        summary: {
            priority: string;
            avg_start_minutes: number;
            avg_start_formatted: string;
            count_start: number;
            avg_resolution_minutes: number;
            avg_resolution_formatted: string;
            count_resolution: number;
        }[];
        counts: {
            id: any;
            folio: any;
            priority: any;
            classification: any;
            branch_name: any;
            responsible_name: any;
            assigned_at: any;
            started_at: any;
            elapsed_minutes: number;
            elapsed_formatted: string;
        }[];
        requests: {
            id: any;
            request_folio: any;
            count_folio: any;
            priority: any;
            classification: any;
            branch_name: any;
            reviewer_name: any;
            created_at: any;
            reviewed_at: any;
            elapsed_minutes: number;
            elapsed_formatted: string;
        }[];
    }>;
}
export declare const reportsService: ReportsService;
export default reportsService;
//# sourceMappingURL=ReportsService.d.ts.map