"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_UPLOADS_DIR_PATH = exports.chatAttachmentUpload = exports.ensureChatAttachmentsDirectory = exports.UPLOADS_DIR_PATH = exports.bulkRequestUpload = exports.ensureUploadsDirectory = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads', 'bulk-requests');
const ensureUploadsDirectory = () => {
    if (!fs_1.default.existsSync(UPLOADS_DIR)) {
        fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
};
exports.ensureUploadsDirectory = ensureUploadsDirectory;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx']);
const ALLOWED_MIME_TYPES = new Set([
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    'application/csv',
    'text/plain'
]);
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        (0, exports.ensureUploadsDirectory)();
        cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${crypto_1.default.randomUUID()}${ext}`;
        cb(null, safeName);
    }
});
exports.bulkRequestUpload = (0, multer_1.default)({
    storage,
    limits: {
        files: 3,
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error('Solo se permiten archivos CSV o Excel (.csv, .xls, .xlsx)'));
            return;
        }
        cb(null, true);
    }
});
exports.UPLOADS_DIR_PATH = UPLOADS_DIR;
// ============================================
// Adjuntos de chat (Diferencias / Diferencias masivas)
// ============================================
const CHAT_UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads', 'chat-attachments');
const ensureChatAttachmentsDirectory = () => {
    if (!fs_1.default.existsSync(CHAT_UPLOADS_DIR)) {
        fs_1.default.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
    }
};
exports.ensureChatAttachmentsDirectory = ensureChatAttachmentsDirectory;
const CHAT_ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'
]);
const CHAT_ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/octet-stream',
    'application/csv'
]);
const chatStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        (0, exports.ensureChatAttachmentsDirectory)();
        cb(null, CHAT_UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${crypto_1.default.randomUUID()}${ext}`;
        cb(null, safeName);
    }
});
exports.chatAttachmentUpload = (0, multer_1.default)({
    storage: chatStorage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (!CHAT_ALLOWED_EXTENSIONS.has(ext) || !CHAT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error('Tipo de archivo no permitido para adjuntos de chat'));
            return;
        }
        cb(null, true);
    }
});
exports.CHAT_UPLOADS_DIR_PATH = CHAT_UPLOADS_DIR;
//# sourceMappingURL=upload.js.map