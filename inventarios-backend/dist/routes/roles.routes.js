"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const rolesController_1 = __importDefault(require("../controllers/rolesController"));
const router = (0, express_1.Router)();
// Todas las rutas de roles requieren autenticación
router.use(auth_1.authMiddleware);
router.get('/', rolesController_1.default.listRoles);
router.get('/:id', rolesController_1.default.getRole);
router.put('/:id', rolesController_1.default.updateRolePermissions);
exports.default = router;
//# sourceMappingURL=roles.routes.js.map