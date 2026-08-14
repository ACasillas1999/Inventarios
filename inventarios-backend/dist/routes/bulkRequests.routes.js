"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const bulkRequestsController_1 = __importDefault(require("../controllers/bulkRequestsController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
const handleUpload = (req, res, next) => {
    upload_1.bulkRequestUpload.array('files', 3)(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (err) {
            res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' });
            return;
        }
        next();
    });
};
const handleChatAttachmentUpload = (req, res, next) => {
    upload_1.chatAttachmentUpload.single('attachment')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            res.status(400).json({ error: err.message });
            return;
        }
        if (err) {
            res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' });
            return;
        }
        next();
    });
};
router.get('/', bulkRequestsController_1.default.listBulkRequests);
router.get('/:id', bulkRequestsController_1.default.getBulkRequest);
router.post('/', (0, auth_1.requirePermission)('bulk_requests.create'), handleUpload, bulkRequestsController_1.default.createBulkRequest);
router.patch('/:id/status', (0, auth_1.requirePermission)('bulk_requests.manage'), bulkRequestsController_1.default.updateBulkRequestStatus);
router.get('/:id/files/:fileId/download', bulkRequestsController_1.default.downloadBulkRequestFile);
router.get('/:id/files/:fileId/downloads', bulkRequestsController_1.default.listBulkRequestFileDownloads);
// Comments (chat en vivo)
router.get('/:id/comments', bulkRequestsController_1.default.listBulkRequestComments);
router.post('/:id/comments', handleChatAttachmentUpload, bulkRequestsController_1.default.createBulkRequestComment);
router.get('/:id/comments/:commentId/attachment', bulkRequestsController_1.default.downloadBulkCommentAttachment);
exports.default = router;
//# sourceMappingURL=bulkRequests.routes.js.map