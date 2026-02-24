"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.getProfile = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const auth_1 = require("../middlewares/auth");
const logger_1 = require("../utils/logger");
/**
 * Login de usuario
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        // Buscar usuario
        const [users] = await pool.execute(`SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.status = 'active'`, [email]);
        if (users.length === 0) {
            logger_1.logger.warn(`Login attempt with invalid email: ${email}`);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const user = users[0];
        // Verificar contraseña
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            logger_1.logger.warn(`Login attempt with invalid password for user: ${email}`);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Actualizar último login
        await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        // Generar token
        const token = (0, auth_1.generateToken)({
            id: user.id,
            email: user.email,
            role_id: user.role_id
        });
        // Obtener sucursales del usuario
        const [branches] = await pool.execute(`SELECT b.id, b.code, b.name, b.status
       FROM branches b
       INNER JOIN user_branches ub ON b.id = ub.branch_id
       WHERE ub.user_id = ?`, [user.id]);
        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role_id: user.role_id,
            role_name: user.role_name,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
            status: user.status,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login: user.last_login,
            branches: branches
        };
        logger_1.logger.info(`User logged in: ${email}`);
        res.json({
            token,
            user: userResponse
        });
    }
    catch (error) {
        logger_1.logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
/**
 * Obtiene el perfil del usuario autenticado
 */
const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        const [users] = await pool.execute(`SELECT u.*, r.name as role_name, r.permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`, [userId]);
        if (users.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const user = users[0];
        // Obtener sucursales del usuario
        const [branches] = await pool.execute(`SELECT b.id, b.code, b.name, b.status
       FROM branches b
       INNER JOIN user_branches ub ON b.id = ub.branch_id
       WHERE ub.user_id = ?`, [userId]);
        const userResponse = {
            id: user.id,
            email: user.email,
            name: user.name,
            role_id: user.role_id,
            role_name: user.role_name,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
            status: user.status,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login: user.last_login,
            branches: branches
        };
        res.json(userResponse);
    }
    catch (error) {
        logger_1.logger.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProfile = getProfile;
/**
 * Cambia la contraseña del usuario
 */
const changePassword = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current and new password are required' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters' });
            return;
        }
        const pool = (0, database_1.getLocalPool)();
        // Obtener usuario
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [
            userId
        ]);
        if (users.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const user = users[0];
        // Verificar contraseña actual
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }
        // Hash de la nueva contraseña
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        // Actualizar contraseña
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        logger_1.logger.info(`Password changed for user ${userId}`);
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        logger_1.logger.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.changePassword = changePassword;
exports.default = { login: exports.login, getProfile: exports.getProfile, changePassword: exports.changePassword };
//# sourceMappingURL=authController.js.map