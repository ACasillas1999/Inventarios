import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middlewares/auth'
import { specialLinesService } from '../services/SpecialLinesService'
import { logger } from '../utils/logger'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authMiddleware)

/**
 * GET /api/special-lines
 * Obtiene todas las líneas especiales
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const activeOnly = req.query.active === 'true'
        const lines = activeOnly
            ? await specialLinesService.getActive()
            : await specialLinesService.getAll()

        return res.json({ lines })
    } catch (error) {
        logger.error('Error getting special lines:', error)
        return res.status(500).json({
            error: 'Error al obtener las líneas especiales'
        })
    }
})

/**
 * GET /api/special-lines/:id
 * Obtiene una línea especial por ID
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' })
        }

        const line = await specialLinesService.getById(id)
        if (!line) {
            return res.status(404).json({ error: 'Línea especial no encontrada' })
        }

        return res.json(line)
    } catch (error) {
        logger.error('Error getting special line:', error)
        return res.status(500).json({
            error: 'Error al obtener la línea especial'
        })
    }
})

/**
 * POST /api/special-lines
 * Crea una nueva línea especial
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { line_code, line_name, tolerance_percentage, whatsapp_numbers, is_active } = req.body

        if (!line_code) {
            return res.status(400).json({ error: 'El código de línea es requerido' })
        }

        const userId = (req as any).user?.id
        const line = await specialLinesService.create({
            line_code,
            line_name,
            tolerance_percentage,
            whatsapp_numbers,
            is_active
        }, userId)

        return res.status(201).json(line)
    } catch (error: any) {
        logger.error('Error creating special line:', error)
        return res.status(400).json({
            error: error.message || 'Error al crear la línea especial'
        })
    }
})

/**
 * PUT /api/special-lines/:id
 * Actualiza una línea especial
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' })
        }

        const { line_name, tolerance_percentage, whatsapp_numbers, is_active } = req.body

        const userId = (req as any).user?.id
        const line = await specialLinesService.update(id, {
            line_name,
            tolerance_percentage,
            whatsapp_numbers,
            is_active
        }, userId)

        return res.json(line)
    } catch (error: any) {
        logger.error('Error updating special line:', error)
        return res.status(400).json({
            error: error.message || 'Error al actualizar la línea especial'
        })
    }
})

/**
 * DELETE /api/special-lines/:id
 * Elimina una línea especial
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' })
        }

        const userId = (req as any).user?.id
        await specialLinesService.delete(id, userId)
        return res.json({ message: 'Línea especial eliminada correctamente' })
    } catch (error) {
        logger.error('Error deleting special line:', error)
        return res.status(500).json({
            error: 'Error al eliminar la línea especial'
        })
    }
})

/**
 * POST /api/special-lines/:id/toggle
 * Activa o desactiva una línea especial
 */
router.post('/:id/toggle', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID inválido' })
        }

        const { is_active } = req.body
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active debe ser un booleano' })
        }

        const userId = (req as any).user?.id
        const line = await specialLinesService.toggleActive(id, is_active, userId)
        return res.json(line)
    } catch (error) {
        logger.error('Error toggling special line:', error)
        return res.status(500).json({
            error: 'Error al cambiar el estado de la línea especial'
        })
    }
})

export default router
