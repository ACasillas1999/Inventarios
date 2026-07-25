import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { bulkRequestUpload, chatAttachmentUpload } from '../middlewares/upload'
import bulkRequestsController from '../controllers/bulkRequestsController'

const router = Router()
router.use(authMiddleware)

const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  bulkRequestUpload.array('files', 3)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message })
      return
    }
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' })
      return
    }
    next()
  })
}

const handleChatAttachmentUpload = (req: Request, res: Response, next: NextFunction): void => {
  chatAttachmentUpload.single('attachment')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message })
      return
    }
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' })
      return
    }
    next()
  })
}

router.get('/', bulkRequestsController.listBulkRequests)
router.get('/:id', bulkRequestsController.getBulkRequest)
router.post('/', requirePermission('bulk_requests.create'), handleUpload, bulkRequestsController.createBulkRequest)
router.patch(
  '/:id/status',
  requirePermission('bulk_requests.manage'),
  bulkRequestsController.updateBulkRequestStatus
)
router.get('/:id/files/:fileId/download', bulkRequestsController.downloadBulkRequestFile)
router.get('/:id/files/:fileId/downloads', bulkRequestsController.listBulkRequestFileDownloads)

// Comments (chat en vivo)
router.get('/:id/comments', bulkRequestsController.listBulkRequestComments)
router.post('/:id/comments', handleChatAttachmentUpload, bulkRequestsController.createBulkRequestComment)
router.get('/:id/comments/:commentId/attachment', bulkRequestsController.downloadBulkCommentAttachment)

export default router
