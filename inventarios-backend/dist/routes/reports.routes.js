"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const reportsController_1 = __importDefault(require("../controllers/reportsController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/audit', reportsController_1.default.getAuditKPIs);
router.get('/company-overview', reportsController_1.default.getCompanyOverview);
router.get('/coverage', reportsController_1.default.getCoverageReport);
router.get('/line-stats', reportsController_1.default.getLineStats);
router.get('/productivity', reportsController_1.default.getProductivityStats);
exports.default = router;
//# sourceMappingURL=reports.routes.js.map