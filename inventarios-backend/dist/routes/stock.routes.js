"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stockController_1 = __importDefault(require("../controllers/stockController"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authMiddleware);
// Consultas de artículos
router.get('/:branchId/item/:itemCode', stockController_1.default.getItemInfo);
router.get('/:branchId/lines', stockController_1.default.getLines);
router.get('/:branchId/item-codes', stockController_1.default.getItemCodes);
router.get('/:branchId/items', stockController_1.default.searchItems);
// Consultas de existencias
// Nota: rutas más específicas van antes para evitar que /items machee con :itemCode
router.get('/:branchId/:itemCode', stockController_1.default.getStock);
router.post('/:branchId/batch', stockController_1.default.getBatchStock);
router.get('/all/:itemCode', stockController_1.default.getStockAllBranches);
router.post('/compare', stockController_1.default.compareStock);
// Gestión de caché
router.delete('/cache/:branchId/:itemCode?', stockController_1.default.invalidateCache);
exports.default = router;
//# sourceMappingURL=stock.routes.js.map