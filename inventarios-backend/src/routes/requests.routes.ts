import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { authMiddleware, requirePermission } from '../middlewares/auth'
import { chatAttachmentUpload } from '../middlewares/upload'
import requestsController from '../controllers/requestsController'
import commentsController from '../controllers/commentsController'

const router = Router()

router.use(authMiddleware)

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

router.get('/', requestsController.listRequests)
router.get('/:id', requestsController.getRequest)
router.patch('/:id', requirePermission('requests.update'), requestsController.updateRequest)

// Comments (chat en vivo)
router.get('/:id/comments', commentsController.listComments)
router.post('/:id/comments', handleChatAttachmentUpload, commentsController.createComment)
router.get('/:id/comments/:commentId/attachment', commentsController.downloadCommentAttachment)

export default router

