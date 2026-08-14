import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const getAuditKPIs: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCompanyOverview: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCoverageReport: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getLineStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getProductivityStats: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getAdjustmentsReport: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getPriorityTimesReport: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBulkRequestsReport: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    getAuditKPIs: (req: AuthRequest, res: Response) => Promise<void>;
    getCompanyOverview: (req: AuthRequest, res: Response) => Promise<void>;
    getCoverageReport: (req: AuthRequest, res: Response) => Promise<void>;
    getLineStats: (req: AuthRequest, res: Response) => Promise<void>;
    getProductivityStats: (req: AuthRequest, res: Response) => Promise<void>;
    getAdjustmentsReport: (req: AuthRequest, res: Response) => Promise<void>;
    getPriorityTimesReport: (req: AuthRequest, res: Response) => Promise<void>;
    getBulkRequestsReport: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=reportsController.d.ts.map