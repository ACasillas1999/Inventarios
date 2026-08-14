"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const notificationsController_1 = __importDefault(require("../controllers/notificationsController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', notificationsController_1.default.listNotifications);
router.post('/read-all', notificationsController_1.default.markAllNotificationsRead);
router.post('/read-for-entity', notificationsController_1.default.markNotificationsReadForEntity);
router.post('/:id/read', notificationsController_1.default.markNotificationRead);
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map