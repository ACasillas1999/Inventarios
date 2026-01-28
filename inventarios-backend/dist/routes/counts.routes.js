"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const countsController_1 = __importDefault(require("../controllers/countsController"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authMiddleware);
// Estadísticas
router.get('/stats/dashboard', countsController_1.default.getDashboardStats);
router.get('/differences', countsController_1.default.listDifferences);
// CRUD de conteos
router.post('/', countsController_1.default.createCount);
router.get('/', countsController_1.default.listCounts);
router.get('/folio/:folio', countsController_1.default.getCountByFolio);
router.get('/:id', countsController_1.default.getCount);
router.put('/:id', countsController_1.default.updateCount);
router.post('/:id/requests', countsController_1.default.createRequestsFromCount);
router.delete('/:id', countsController_1.default.deleteCount);
// Detalles de conteos
router.get('/:id/details', countsController_1.default.getCountDetails);
router.post('/:id/details', countsController_1.default.addCountDetail);
router.put('/details/:id', countsController_1.default.updateCountDetail);
exports.default = router;
//# sourceMappingURL=counts.routes.js.map