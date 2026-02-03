import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import reportsService from '../services/ReportsService'
import { logger } from '../utils/logger'

export const getAuditKPIs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined
        const dateFrom = req.query.date_from as string
        const dateTo = req.query.date_to as string

        const kpis = await reportsService.getAuditKPIs({
            branch_id: branchId,
            date_from: dateFrom,
            date_to: dateTo
        })

        res.json(kpis)
    } catch (error) {
        logger.error('Get Audit KPIs error:', error)
        res.status(500).json({ error: 'Failed to generate audit report' })
    }
}

export const getCompanyOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const overview = await reportsService.getCompanyOverview()
        res.json(overview)
    } catch (error) {
        logger.error('Get Company Overview error:', error)
        res.status(500).json({ error: 'Failed to generate company overview' })
    }
}

export const getCoverageReport = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined
        const report = await reportsService.getCoverageReport(branchId)
        res.json(report)
    } catch (error) {
        logger.error('Get Coverage Report error:', error)
        res.status(500).json({ error: 'Failed to generate coverage report' })
    }
}

export const getLineStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined
        const dateFrom = req.query.date_from as string
        const dateTo = req.query.date_to as string

        const stats = await reportsService.getLineStats({
            branch_id: branchId,
            date_from: dateFrom,
            date_to: dateTo
        })

        res.json(stats)
    } catch (error) {
        logger.error('Get Line Stats error:', error)
        res.status(500).json({ error: 'Failed to generate line stats' })
    }
}

export const getProductivityStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined
        const dateFrom = req.query.date_from as string
        const dateTo = req.query.date_to as string

        const stats = await reportsService.getProductivityStats({
            branch_id: branchId,
            date_from: dateFrom,
            date_to: dateTo
        })

        res.json(stats)
    } catch (error) {
        logger.error('Get Productivity Stats error:', error)
        res.status(500).json({ error: 'Failed to generate productivity report' })
    }
}

export default { getAuditKPIs, getCompanyOverview, getCoverageReport, getLineStats, getProductivityStats }
