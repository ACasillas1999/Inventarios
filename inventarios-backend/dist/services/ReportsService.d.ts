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
        date_from?: string;
        date_to?: string;
    }): Promise<KPIStats>;
    /**
     * Obtiene una vista general de la empresa
     */
    getCompanyOverview(): Promise<CompanyOverview>;
    /**
     * Obtiene el reporte de cobertura jerárquico
     */
    getCoverageReport(branchId?: number): Promise<CoverageItem[]>;
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
        date_from?: string;
        date_to?: string;
    }): Promise<{
        topSurtidores: any[] | RowDataPacket[];
        topSolicitantes: any[] | RowDataPacket[];
        topRevisores: any[] | RowDataPacket[];
    }>;
}
export declare const reportsService: ReportsService;
export default reportsService;
//# sourceMappingURL=ReportsService.d.ts.map