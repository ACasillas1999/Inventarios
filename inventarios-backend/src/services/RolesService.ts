import { getLocalPool } from '../config/database'
import { RowDataPacket } from 'mysql2/promise'
import { Role } from '../types'

export class RolesService {
    private pool = getLocalPool()

    async getAll(): Promise<Role[]> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT id, name, display_name, description, permissions, created_at, updated_at 
       FROM roles ORDER BY id ASC`
        )
        return rows.map(row => ({
            ...row,
            permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
        })) as Role[]
    }

    async getById(id: number): Promise<Role | null> {
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT id, name, display_name, description, permissions, created_at, updated_at 
       FROM roles WHERE id = ?`,
            [id]
        )
        if (rows.length === 0) return null
        const role = rows[0]
        return {
            ...role,
            permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
        } as Role
    }

    async updatePermissions(id: number, permissions: string[]): Promise<boolean> {
        const [result] = await this.pool.execute(
            'UPDATE roles SET permissions = ? WHERE id = ?',
            [JSON.stringify(permissions), id]
        )
        return (result as any).affectedRows > 0
    }
}

export default RolesService
