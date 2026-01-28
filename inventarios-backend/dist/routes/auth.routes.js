"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = __importDefault(require("../controllers/authController"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Rutas públicas
router.post('/login', authController_1.default.login);
// Rutas protegidas
router.get('/profile', auth_1.authMiddleware, authController_1.default.getProfile);
router.post('/change-password', auth_1.authMiddleware, authController_1.default.changePassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map