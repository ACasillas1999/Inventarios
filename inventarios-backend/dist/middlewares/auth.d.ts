import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role_id: number;
    };
}
/**
 * Middleware para verificar el token JWT
 */
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware para verificar roles específicos
 */
export declare const requireRole: (...allowedRoles: number[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Genera un token JWT
 */
export declare const generateToken: (user: {
    id: number;
    email: string;
    role_id: number;
}) => string;
/**
 * Verifica un token sin lanzar error
 */
export declare const verifyToken: (token: string) => any | null;
export default authMiddleware;
//# sourceMappingURL=auth.d.ts.map