import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listRoles: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const getRole: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateRolePermissions: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listRoles: (_req: AuthRequest, res: Response) => Promise<void>;
    getRole: (req: AuthRequest, res: Response) => Promise<void>;
    updateRolePermissions: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=rolesController.d.ts.map