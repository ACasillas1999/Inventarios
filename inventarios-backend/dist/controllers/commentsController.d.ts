import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listComments: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createComment: (req: AuthRequest, res: Response) => Promise<void>;
export declare const downloadCommentAttachment: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listComments: (req: AuthRequest, res: Response) => Promise<void>;
    createComment: (req: AuthRequest, res: Response) => Promise<void>;
    downloadCommentAttachment: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=commentsController.d.ts.map