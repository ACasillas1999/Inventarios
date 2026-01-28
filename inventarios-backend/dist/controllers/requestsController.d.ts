import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listRequests: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getRequest: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateRequest: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listRequests: (req: AuthRequest, res: Response) => Promise<void>;
    getRequest: (req: AuthRequest, res: Response) => Promise<void>;
    updateRequest: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=requestsController.d.ts.map