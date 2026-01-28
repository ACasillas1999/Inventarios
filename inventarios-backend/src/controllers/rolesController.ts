import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import RolesService from '../services/RolesService'
import { logger } from '../utils/logger'

const rolesService = new RolesService()

export const listRoles = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const roles = await rolesService.getAll()
        res.json(roles)
    } catch (error) {
        logger.error('List roles error:', error)
        res.status(500).json({ error: 'Failed to list roles' })
    }
}

export const getRole = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const roleId = parseInt(req.params.id)
        const role = await rolesService.getById(roleId)

        if (!role) {
            res.status(404).json({ error: 'Role not found' })
            return
        }

        res.json(role)
    } catch (error) {
        logger.error('Get role error:', error)
        res.status(500).json({ error: 'Failed to get role' })
    }
}

export const updateRolePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const roleId = parseInt(req.params.id)
        const { permissions } = req.body

        if (!Array.isArray(permissions)) {
            res.status(400).json({ error: 'Permissions must be an array of strings' })
            return
        }

        const success = await rolesService.updatePermissions(roleId, permissions)

        if (!success) {
            res.status(404).json({ error: 'Role not found' })
            return
        }

        res.json({ message: 'Permissions updated successfully' })
    } catch (error) {
        logger.error('Update role permissions error:', error)
        res.status(500).json({ error: 'Failed to update permissions' })
    }
}

export default { listRoles, getRole, updateRolePermissions }
