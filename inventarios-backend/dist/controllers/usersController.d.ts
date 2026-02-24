import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare const listUsers: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createUser: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateUserStatus: (req: AuthRequest, res: Response) => Promise<void>;
export declare const changeUserPassword: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateUser: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateUserNotifications: (req: AuthRequest, res: Response) => Promise<void>;
declare const _default: {
    listUsers: (req: AuthRequest, res: Response) => Promise<void>;
    createUser: (req: AuthRequest, res: Response) => Promise<void>;
    updateUserStatus: (req: AuthRequest, res: Response) => Promise<void>;
    changeUserPassword: (req: AuthRequest, res: Response) => Promise<void>;
    updateUser: (req: AuthRequest, res: Response) => Promise<void>;
    updateUserNotifications: (req: AuthRequest, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=usersController.d.ts.map