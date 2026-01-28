import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import RequestsService, { type RequestStatus } from '../services/RequestsService'
import { logger } from '../utils/logger'

const requestsService = new RequestsService()

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export const listRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statusRaw = req.query.status ? String(req.query.status) : undefined
    const allowed: RequestStatus[] = ['pendiente', 'en_revision', 'ajustado', 'rechazado']
    const status =
      statusRaw && allowed.includes(statusRaw as RequestStatus)
        ? (statusRaw as RequestStatus)
        : undefined

    if (statusRaw && !status) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const branch_id = parseNumber(req.query.branch_id)
    const count_id = parseNumber(req.query.count_id)
    const limit = parseNumber(req.query.limit)
    const offset = parseNumber(req.query.offset)

    const result = await requestsService.listRequests({
      status,
      branch_id,
      count_id,
      limit,
      offset
    })

    res.json(result)
  } catch (error) {
    logger.error('List requests error:', error)
    res.status(500).json({ error: 'Failed to list requests' })
  }
}

export const getRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid request ID' })
      return
    }

    const request = await requestsService.getById(id)
    if (!request) {
      res.status(404).json({ error: 'Request not found' })
      return
    }

    res.json(request)
  } catch (error) {
    logger.error('Get request error:', error)
    res.status(500).json({ error: 'Failed to get request' })
  }
}

export const updateRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const id = Number(req.params.id)
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid request ID' })
      return
    }

    const statusRaw = req.body?.status !== undefined ? String(req.body.status) : undefined
    const allowed: RequestStatus[] = ['pendiente', 'en_revision', 'ajustado', 'rechazado']
    const status =
      statusRaw && allowed.includes(statusRaw as RequestStatus)
        ? (statusRaw as RequestStatus)
        : undefined
    if (statusRaw && !status) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }

    const resolution_notes =
      req.body?.resolution_notes !== undefined ? (req.body.resolution_notes ?? null) : undefined
    const evidence_file =
      req.body?.evidence_file !== undefined ? (req.body.evidence_file ?? null) : undefined

    // Al tocar estatus (o notas) consideramos al usuario como revisor.
    const reviewTouched = status !== undefined || resolution_notes !== undefined
    const updated = await requestsService.updateRequest(id, {
      status,
      resolution_notes,
      evidence_file,
      reviewed_by_user_id: reviewTouched ? userId : undefined,
      reviewed_at: reviewTouched ? 'NOW' : undefined
    })

    res.json(updated)
  } catch (error) {
    logger.error('Update request error:', error)
    if (error instanceof Error && error.message === 'Request not found') {
      res.status(404).json({ error: 'Request not found' })
      return
    }
    res.status(500).json({ error: 'Failed to update request' })
  }
}

export default { listRequests, getRequest, updateRequest }
