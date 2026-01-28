import { Branch } from '../types';
import { BranchDbConfig } from '../config/database';
/**
 * BranchesService - Servicio para gestionar sucursales en la base de datos local
 */
export declare class BranchesService {
    private pool;
    /**
     * Obtiene todas las sucursales de la base de datos local
     */
    getAllBranches(): Promise<Branch[]>;
    /**
     * Obtiene una sucursal por ID
     */
    getBranchById(id: number): Promise<Branch | null>;
    /**
     * Obtiene una sucursal por código
     */
    getBranchByCode(code: string): Promise<Branch | null>;
    /**
     * Crea una nueva sucursal
     */
    createBranch(data: {
        code: string;
        name: string;
        db_host: string;
        db_port: number;
        db_user: string;
        db_password: string;
        db_database: string;
        status?: 'active' | 'inactive';
    }): Promise<Branch>;
    /**
     * Actualiza una sucursal
     */
    updateBranch(id: number, data: Partial<{
        code: string;
        name: string;
        db_host: string;
        db_port: number;
        db_user: string;
        db_password: string;
        db_database: string;
        status: 'active' | 'inactive' | 'error';
    }>): Promise<Branch>;
    /**
     * Actualiza el estado de conexión de una sucursal
     */
    updateConnectionStatus(id: number, status: 'active' | 'inactive' | 'error', connectionStatus: string, errorMessage?: string): Promise<void>;
    /**
     * Elimina una sucursal
     */
    deleteBranch(id: number): Promise<void>;
    /**
     * Convierte las sucursales de la BD a formato BranchDbConfig
     * Para usar con ConnectionManager
     */
    getBranchesAsConfig(): Promise<BranchDbConfig[]>;
    /**
     * Prueba la conexión a una sucursal
     */
    testConnection(id: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
export default BranchesService;
//# sourceMappingURL=BranchesService.d.ts.map