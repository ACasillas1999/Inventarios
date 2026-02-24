import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import auditService from '../services/AuditService'
import { logger } from '../utils/logger'

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined
        const entityType = req.query.entity_type as string
        const entityId = req.query.entity_id ? parseInt(req.query.entity_id as string) : undefined
        const dateFrom = req.query.date_from as string
        const dateTo = req.query.date_to as string
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0

        const result = await auditService.list({
            user_id: userId,
            entity_type: entityType,
            entity_id: entityId,
            date_from: dateFrom,
            date_to: dateTo,
            limit,
            offset
        })

        res.json(result)
    } catch (error) {
        logger.error('List Audit Logs error:', error)
        res.status(500).json({ error: 'Failed to fetch audit logs' })
    }
}

export default { listAuditLogs }
