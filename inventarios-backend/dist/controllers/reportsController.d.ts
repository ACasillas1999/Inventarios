import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const getAuditKPIs: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCompanyOverview: (_req: AuthRequest, res: Response) => Promise<void>;
export declare const getCoverageReport: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getLineStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getProductivityStats: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    getAuditKPIs: (req: AuthRequest, res: Response) => Promise<void>;
    getCompanyOverview: (_req: AuthRequest, res: Response) => Promise<void>;
    getCoverageReport: (req: AuthRequest, res: Response) => Promise<void>;
    getLineStats: (req: AuthRequest, res: Response) => Promise<void>;
    getProductivityStats: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=reportsController.d.ts.map