import { BranchDbConfig } from '../config/database';
export declare class BranchesService {
    private pool;
    /**
     * Obtiene todas las sucursales directamente de la DB
     */
    getAllFromDb(): Promise<any[]>;
    /**
     * Crea una nueva sucursal
     */
    create(data: Partial<BranchDbConfig>): Promise<number>;
    /**
     * Actualiza una sucursal existente
     */
    update(id: number, data: Partial<BranchDbConfig>): Promise<void>;
    /**
     * Elimina una sucursal
     */
    delete(id: number): Promise<void>;
}
export declare const branchesService: BranchesService;
//# sourceMappingURL=BranchesService.d.ts.map