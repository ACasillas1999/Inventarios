import mysql from 'mysql2/promise';
import { BranchDbConfig } from '../config/database';
/**
 * ConnectionManager - Gestor de conexiones a múltiples bases de datos
 * Mantiene pools de conexiones para cada sucursal y monitorea su estado
 */
export declare class ConnectionManager {
    private static instance;
    private branchPools;
    private healthCheckInterval;
    private constructor();
    static getInstance(): ConnectionManager;
    /**
     * Inicializa las conexiones a todas las sucursales
     */
    initializeBranches(branches: BranchDbConfig[]): Promise<void>;
    /**
     * Agrega una nueva conexión de sucursal o actualiza una existente
     */
    addBranch(config: BranchDbConfig): Promise<void>;
    /**
     * Elimina una conexión de sucursal y cierra su pool
     */
    removeBranch(branchId: number): Promise<void>;
    /**
     * Obtiene el pool de una sucursal por ID
     */
    getPool(branchId: number): mysql.Pool | null;
    /**
     * Obtiene el pool de una sucursal por código
     */
    getPoolByCode(branchCode: string): mysql.Pool | null;
    /**
     * Ejecuta una consulta en una sucursal específica
     */
    executeQuery<T = any>(branchId: number, query: string, params?: any[]): Promise<T[]>;
    /**
     * Ejecuta una consulta en todas las sucursales en paralelo
     */
    executeQueryOnAllBranches<T = any>(query: string, params?: any[]): Promise<Map<number, T[]>>;
    /**
     * Verifica el estado de salud de una sucursal
     */
    checkBranchHealth(branchId: number): Promise<boolean>;
    /**
     * Verifica el estado de todas las sucursales
     */
    checkAllBranchesHealth(): Promise<Map<number, boolean>>;
    /**
     * Obtiene el estado de todas las sucursales
     */
    getBranchesStatus(): Array<{
        id: number;
        code: string;
        name: string;
        status: string;
        lastCheck: Date;
        errorMessage?: string;
    }>;
    /**
     * Inicia el monitoreo periódico de salud
     */
    private startHealthCheck;
    /**
     * Detiene el monitoreo de salud
     */
    stopHealthCheck(): void;
    /**
     * Cierra todas las conexiones
     */
    closeAll(): Promise<void>;
    /**
     * Obtiene la cantidad de sucursales conectadas
     */
    getConnectedBranchesCount(): number;
    /**
     * Obtiene todas las configuraciones de sucursales
     */
    getAllBranchConfigs(): BranchDbConfig[];
}
export default ConnectionManager;
//# sourceMappingURL=ConnectionManager.d.ts.map