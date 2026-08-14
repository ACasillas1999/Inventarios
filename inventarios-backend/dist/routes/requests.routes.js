"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const requestsController_1 = __importDefault(require("../controllers/requestsController"));
const commentsController_1 = __importDefault(require("../controllers/commentsController"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
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
router.get('/', requestsController_1.default.listRequests);
router.get('/:id', requestsController_1.default.getRequest);
router.patch('/:id', (0, auth_1.requirePermission)('requests.update'), requestsController_1.default.updateRequest);
// Comments (chat en vivo)
router.get('/:id/comments', commentsController_1.default.listComments);
router.post('/:id/comments', handleChatAttachmentUpload, commentsController_1.default.createComment);
router.get('/:id/comments/:commentId/attachment', commentsController_1.default.downloadCommentAttachment);
exports.default = router;
//# sourceMappingURL=requests.routes.js.map