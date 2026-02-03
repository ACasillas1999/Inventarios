import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import UsersService, { CreateUserData } from '../services/UsersService'
import { logger } from '../utils/logger'

const usersService = new UsersService()

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await usersService.getAll()
    res.json(users)
  } catch (error) {
    logger.error('List users error:', error)
    res.status(500).json({ error: 'Failed to list users' })
  }
}

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role_id, branch_id, branch_ids, phone_number } = req.body

    // Validation
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }

    // Check if email already exists
    const existingUsers = await usersService.getAll()
    if (existingUsers.some(u => u.email === email)) {
      res.status(409).json({ error: 'User with this email already exists' })
      return
    }

    const userData: CreateUserData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role_id,
      branch_id,
      branch_ids,
      phone_number
    }

    const newUser = await usersService.create(userData)
    logger.info(`User created: ${newUser.email} by ${req.user?.email}`)

    res.status(201).json(newUser)
  } catch (error: any) {
    logger.error('Create user error:', error)

    // Handle duplicate email error
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'User with this email already exists' })
      return
    }

    res.status(500).json({ error: 'Failed to create user' })
  }
}

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id)
    const { status } = req.body

    let finalStatus = status
    if (status === 'activo') finalStatus = 'active'
    if (status === 'suspendido') finalStatus = 'suspended'

    if (!['active', 'suspended', 'inactive'].includes(finalStatus)) {
      res.status(400).json({ error: 'Invalid status value' })
      return
    }

    await usersService.updateStatus(userId, finalStatus)
    logger.info(`User ${userId} status updated to ${status} by ${req.user?.email}`)

    res.json({ message: 'User status updated successfully' })
  } catch (error) {
    logger.error('Update user status error:', error)
    res.status(500).json({ error: 'Failed to update user status' })
  }
}

export const changeUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id)
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' })
      return
    }

    await usersService.changePassword(userId, newPassword)
    logger.info(`User ${userId} password changed by ${req.user?.email}`)

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    logger.error('Change password error:', error)
    res.status(500).json({ error: 'Failed to change password' })
  }
}

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id)
    const { name, email, password, role_id, branch_ids, phone_number, status } = req.body

    const userData: any = {}
    if (name) userData.name = name.trim()
    if (email) userData.email = email.trim().toLowerCase()
    if (password) userData.password = password
    if (role_id) userData.role_id = role_id
    if (branch_ids) userData.branch_ids = branch_ids
    if (phone_number !== undefined) userData.phone_number = phone_number
    if (status) userData.status = status

    const updatedUser = await usersService.update(userId, userData)
    logger.info(`User updated: ${updatedUser.email} by ${req.user?.email}`)

    res.json(updatedUser)
  } catch (error) {
    logger.error('Update user error:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
}

export const updateUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.id)
    const { subscriptions } = req.body // Array of { event_key: string, branch_id: number | null }

    if (!Array.isArray(subscriptions)) {
      res.status(400).json({ error: 'Subscriptions must be an array' })
      return
    }

    await usersService.updateSubscriptions(userId, subscriptions)
    logger.info(`User ${userId} notifications updated by ${req.user?.email}`)

    res.json({ message: 'Notifications updated successfully' })
  } catch (error) {
    logger.error('Update notifications error:', error)
    res.status(500).json({ error: 'Failed to update notifications' })
  }
}

export default { listUsers, createUser, updateUserStatus, changeUserPassword, updateUser, updateUserNotifications }
