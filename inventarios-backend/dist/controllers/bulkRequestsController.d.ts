import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listBulkRequests: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getBulkRequest: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createBulkRequest: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateBulkRequestStatus: (req: AuthRequest, res: Response) => Promise<void>;
export declare const downloadBulkRequestFile: (req: AuthRequest, res: Response) => Promise<void>;
export declare const listBulkRequestFileDownloads: (req: AuthRequest, res: Response) => Promise<void>;
export declare const listBulkRequestComments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createBulkRequestComment: (req: AuthRequest, res: Response) => Promise<void>;
export declare const downloadBulkCommentAttachment: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listBulkRequests: (req: AuthRequest, res: Response) => Promise<void>;
    getBulkRequest: (req: AuthRequest, res: Response) => Promise<void>;
    createBulkRequest: (req: AuthRequest, res: Response) => Promise<void>;
    updateBulkRequestStatus: (req: AuthRequest, res: Response) => Promise<void>;
    downloadBulkRequestFile: (req: AuthRequest, res: Response) => Promise<void>;
    listBulkRequestFileDownloads: (req: AuthRequest, res: Response) => Promise<void>;
    listBulkRequestComments: (req: AuthRequest, res: Response) => Promise<void>;
    createBulkRequestComment: (req: AuthRequest, res: Response) => Promise<void>;
    downloadBulkCommentAttachment: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=bulkRequestsController.d.ts.map