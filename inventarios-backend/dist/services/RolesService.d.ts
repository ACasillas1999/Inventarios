import { Role } from '../types';
export declare class RolesService {
    private pool;
    getAll(): Promise<Role[]>;
    getById(id: number): Promise<Role | null>;
    updatePermissions(id: number, permissions: string[]): Promise<boolean>;
}
export default RolesService;
//# sourceMappingURL=RolesService.d.ts.map