"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const usersController_1 = __importDefault(require("../controllers/usersController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', usersController_1.default.listUsers);
router.post('/', usersController_1.default.createUser);
router.put('/:id', usersController_1.default.updateUser);
router.patch('/:id', usersController_1.default.updateUserStatus);
router.put('/:id/notifications', usersController_1.default.updateUserNotifications);
router.post('/:id/change-password', usersController_1.default.changeUserPassword);
exports.default = router;
//# sourceMappingURL=users.routes.js.map