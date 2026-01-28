"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const requestsController_1 = __importDefault(require("../controllers/requestsController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', requestsController_1.default.listRequests);
router.get('/:id', requestsController_1.default.getRequest);
router.patch('/:id', requestsController_1.default.updateRequest);
exports.default = router;
//# sourceMappingURL=requests.routes.js.map