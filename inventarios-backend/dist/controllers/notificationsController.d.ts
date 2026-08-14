import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listNotifications: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markNotificationRead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markAllNotificationsRead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markNotificationsReadForEntity: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listNotifications: (req: AuthRequest, res: Response) => Promise<void>;
    markNotificationRead: (req: AuthRequest, res: Response) => Promise<void>;
    markAllNotificationsRead: (req: AuthRequest, res: Response) => Promise<void>;
    markNotificationsReadForEntity: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=notificationsController.d.ts.map