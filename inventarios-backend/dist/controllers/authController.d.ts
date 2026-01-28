import { Request, Response } from 'express';
/**
 * Login de usuario
 */
export declare const login: (req: Request, res: Response) => Promise<void>;
/**
 * Obtiene el perfil del usuario autenticado
 */
export declare const getProfile: (req: any, res: Response) => Promise<void>;
/**
 * Cambia la contraseña del usuario
 */
export declare const changePassword: (req: any, res: Response) => Promise<void>;
declare const _default: {
    login: (req: Request, res: Response) => Promise<void>;
    getProfile: (req: any, res: Response) => Promise<void>;
    changePassword: (req: any, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=authController.d.ts.map