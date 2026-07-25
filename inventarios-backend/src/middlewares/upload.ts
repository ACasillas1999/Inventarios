import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'bulk-requests')

export const ensureUploadsDirectory = (): void => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
}

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx'])
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/csv',
  'text/plain'
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDirectory()
    cb(null, UPLOADS_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`
    cb(null, safeName)
  }
})

export const bulkRequestUpload = multer({
  storage,
  limits: {
    files: 3,
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Solo se permiten archivos CSV o Excel (.csv, .xls, .xlsx)'))
      return
    }
    cb(null, true)
  }
})

export const UPLOADS_DIR_PATH = UPLOADS_DIR

// ============================================
// Adjuntos de chat (Diferencias / Diferencias masivas)
// ============================================

const CHAT_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'chat-attachments')

export const ensureChatAttachmentsDirectory = (): void => {
  if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
    fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true })
  }
}

const CHAT_ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'
])
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
])

const chatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureChatAttachmentsDirectory()
    cb(null, CHAT_UPLOADS_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`
    cb(null, safeName)
  }
})

export const chatAttachmentUpload = multer({
  storage: chatStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!CHAT_ALLOWED_EXTENSIONS.has(ext) || !CHAT_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Tipo de archivo no permitido para adjuntos de chat'))
      return
    }
    cb(null, true)
  }
})

export const CHAT_UPLOADS_DIR_PATH = CHAT_UPLOADS_DIR
