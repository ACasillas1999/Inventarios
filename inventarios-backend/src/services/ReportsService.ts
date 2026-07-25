import { getLocalPool } from '../config/database'
import { RowDataPacket } from 'mysql2/promise'
import { TimeUtils } from '../utils/TimeUtils'
import { ConnectionManager } from '../connections/ConnectionManager'
import { logger } from '../utils/logger'

export interface KPIStats {
    avg_assignment_time: string
    avg_start_time: string
    avg_resolution_time: string
    efficiency_by_user: any[]
    assignment_by_user: any[]
    resolution_by_user: any[]
}

export interface CoverageItem {
    id: string | number
    name: string
    total_items: number
    counted_items: number
    percentage: number
    children?: CoverageItem[]
}

export interface CompanyOverview {
    total_items: number
    counted_items: number
    coverage_percentage: number
    branch_stats: { name: string, percentage: number }[]
}

export class ReportsService {
    private pool = getLocalPool()

    /**
     * Obtiene métricas de auditoría y tiempos de respuesta
     */
    async getAuditKPIs(filters: { branch_id?: number, classification?: string, responsible_user_id?: number, date_from?: string, date_to?: string }): Promise<KPIStats> {
        let query = `
      SELECT 
        c.id, c.folio, c.created_at, c.assigned_at, c.started_at, c.finished_at, c.closed_at,
        u.name as responsible_name,
        creator.name as created_by_name
      FROM counts c
      LEFT JOIN users u ON c.responsible_user_id = u.id
      LEFT JOIN users creator ON c.created_by_user_id = creator.id
      WHERE (c.status = 'cerrado' OR c.status = 'contado')
    `
        const params: any[] = []

        if (filters.branch_id) {
            query += ' AND c.branch_id = ?'
            params.push(filters.branch_id)
        }
        if (filters.classification) {
            query += ' AND c.classification = ?'
            params.push(filters.classification)
        }
        if (filters.responsible_user_id) {
            query += ' AND c.responsible_user_id = ?'
            params.push(filters.responsible_user_id)
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?'
            params.push(filters.date_from)
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?'
            params.push(filters.date_to)
        }

        const [rows] = await this.pool.execute<RowDataPacket[]>(query, params)

        let totalAssignMin = 0
        let countAssign = 0
        let totalStartMin = 0
        let countStart = 0

        const userStats = new Map<string, { total_start_min: number, count_start: number }>()
        const assignmentStats = new Map<string, { total_assign_min: number, count_assign: number }>()

        rows.forEach((row: any) => {
            const created = new Date(row.created_at)
            const assigned = row.assigned_at ? new Date(row.assigned_at) : null
            const started = row.started_at ? new Date(row.started_at) : null

            // KPI 1: Tiempo de reasignación/asignación (Jefe -> Surtidor)
            if (assigned) {
                const min = TimeUtils.getNetWorkingMinutes(created, assigned)
                totalAssignMin += min
                countAssign++

                // Track by created_by user (quien creó/asignó el conteo)
                if (row.created_by_name) {
                    const u = assignmentStats.get(row.created_by_name) || { total_assign_min: 0, count_assign: 0 }
                    u.total_assign_min += min
                    u.count_assign++
                    assignmentStats.set(row.created_by_name, u)
                }
            }

            // KPI 2: Tiempo de inicio (Surtidor recibe -> Surtidor inicia)
            if (assigned && started) {
                const min = TimeUtils.getNetWorkingMinutes(assigned, started)
                totalStartMin += min
                countStart++

                if (row.responsible_name) {
                    const u = userStats.get(row.responsible_name) || { total_start_min: 0, count_start: 0 }
                    u.total_start_min += min
                    u.count_start++
                    userStats.set(row.responsible_name, u)
                }
            }
        })

        // KPI 3: Resolución de solicitudes (Entradas Inventarios)
        let reqQuery = `SELECT r.created_at, r.reviewed_at, u.name as reviewer_name 
       FROM requests r
       JOIN counts c ON r.count_id = c.id
       LEFT JOIN users u ON r.reviewed_by_user_id = u.id
       WHERE r.status != 'pendiente'`
        
        const reqParams: any[] = []
        if (filters.branch_id) {
            reqQuery += ' AND c.branch_id = ?'
            reqParams.push(filters.branch_id)
        }
        if (filters.classification) {
            reqQuery += ' AND c.classification = ?'
            reqParams.push(filters.classification)
        }
        if (filters.responsible_user_id) {
            reqQuery += ' AND c.responsible_user_id = ?'
            reqParams.push(filters.responsible_user_id)
        }
        if (filters.date_from) {
            reqQuery += ' AND c.created_at >= ?'
            reqParams.push(filters.date_from)
        }
        if (filters.date_to) {
            reqQuery += ' AND c.created_at <= ?'
            reqParams.push(filters.date_to)
        }

        const [reqRows] = await this.pool.execute<RowDataPacket[]>(reqQuery, reqParams)
        let totalResMin = 0
        let countRes = 0
        const resolutionStats = new Map<string, { total_res_min: number, count_res: number }>()

        reqRows.forEach((r: any) => {
            if (r.created_at && r.reviewed_at) {
                const min = TimeUtils.getNetWorkingMinutes(new Date(r.created_at), new Date(r.reviewed_at))
                totalResMin += min
                countRes++

                if (r.reviewer_name) {
                    const u = resolutionStats.get(r.reviewer_name) || { total_res_min: 0, count_res: 0 }
                    u.total_res_min += min
                    u.count_res++
                    resolutionStats.set(r.reviewer_name, u)
                }
            }
        })

        return {
            avg_assignment_time: TimeUtils.formatDuration(countAssign > 0 ? Math.floor(totalAssignMin / countAssign) : 0),
            avg_start_time: TimeUtils.formatDuration(countStart > 0 ? Math.floor(totalStartMin / countStart) : 0),
            avg_resolution_time: TimeUtils.formatDuration(countRes > 0 ? Math.floor(totalResMin / countRes) : 0),
            efficiency_by_user: Array.from(userStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_start_min / stats.count_start),
                avg_formatted: TimeUtils.formatDuration(Math.floor(stats.total_start_min / stats.count_start))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes),
            assignment_by_user: Array.from(assignmentStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_assign_min / stats.count_assign),
                avg_formatted: TimeUtils.formatDuration(Math.floor(stats.total_assign_min / stats.count_assign))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes),
            resolution_by_user: Array.from(resolutionStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_res_min / stats.count_res),
                avg_formatted: TimeUtils.formatDuration(Math.floor(stats.total_res_min / stats.count_res))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes)
        }
    }

    /**
     * Obtiene una vista general de la empresa
     */
    async getCompanyOverview(filters?: { only_active?: boolean }): Promise<CompanyOverview> {
        const cm = ConnectionManager.getInstance()
        const branches = cm.getAllBranchConfigs()

        let totalItems = 0
        let totalCounted = 0
        const branchStats: any[] = []

        for (const branch of branches) {
            try {
                // 1. Obtener total de artículos únicos en esta sucursal
                let query = `
                    SELECT COUNT(DISTINCT a.Clave_Articulo) as total 
                    FROM articulo a
                    JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                    JOIN almacenes alm ON aa.Almacen = alm.Almacen
                    WHERE alm.Habilitado = 1
                `;
                if (filters?.only_active) query += ` AND a.Habilitado = 1`;

                let remoteCount: any;
                try {
                    [remoteCount] = await cm.executeQuery<any>(branch.id, query)
                } catch (err: any) {
                    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.sqlState === '42S22') {
                        query = `
                            SELECT COUNT(DISTINCT a.Clave_Articulo) as total 
                            FROM articulo a
                            JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                            JOIN almacenes alm ON aa.Almacen = alm.Almacen
                            WHERE 1=1
                        `;
                        if (filters?.only_active) query += ` AND a.Habilitado = 1`;
                        
                        [remoteCount] = await cm.executeQuery<any>(branch.id, query)
                    } else {
                        throw err
                    }
                }
                const branchTotal = remoteCount?.total || 0;
                totalItems += branchTotal

                // 2. Obtener artículos contados en esta sucursal (local)
                const [localCount] = await this.pool.execute<RowDataPacket[]>(
                    `SELECT COUNT(DISTINCT cd.item_code) as counted 
           FROM count_details cd
           JOIN counts c ON cd.count_id = c.id
           WHERE c.branch_id = ? AND c.status IN ('contado', 'cerrado')`,
                    [branch.id]
                )
                const branchCounted = (localCount[0] as any)?.counted || 0
                totalCounted += branchCounted

                branchStats.push({
                    name: branch.name,
                    percentage: branchTotal > 0 ? Number(((branchCounted / branchTotal) * 100).toFixed(1)) : 0
                })
            } catch (err) {
                logger.error(`Error calculating company overview for branch ${branch.id}:`, err)
            }
        }

        return {
            total_items: totalItems,
            counted_items: totalCounted,
            coverage_percentage: totalItems > 0 ? Number(((totalCounted / totalItems) * 100).toFixed(1)) : 0,
            branch_stats: branchStats
        }
    }

    /**
     * Obtiene el reporte de cobertura jerárquico
     */
    async getCoverageReport(branchId?: number, filters?: { only_active?: boolean }): Promise<CoverageItem[]> {
        const cm = ConnectionManager.getInstance()
        const branches = branchId
            ? cm.getAllBranchConfigs().filter(b => b.id === branchId)
            : cm.getAllBranchConfigs()

        const results: CoverageItem[] = []

        for (const branch of branches) {
            try {
                // Obtener datos por bodega y línea (remoto)
                let remoteQuery = `
                    SELECT aa.Almacen as almacen_id, alm.Nombre as almacen_nombre, LEFT(a.Clave_Articulo, 5) as linea, COUNT(DISTINCT a.Clave_Articulo) as total 
                    FROM articulo a
                    JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                    JOIN almacenes alm ON aa.Almacen = alm.Almacen
                    WHERE alm.Habilitado = 1
                `
                if (filters?.only_active) remoteQuery += ` AND a.Habilitado = 1`;
                remoteQuery += ` GROUP BY aa.Almacen, alm.Nombre, linea`;

                let remoteData: any[];
                try {
                    remoteData = await cm.executeQuery<any>(branch.id, remoteQuery)
                } catch (err: any) {
                    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.sqlState === '42S22') {
                        remoteQuery = `
                            SELECT aa.Almacen as almacen_id, alm.Nombre as almacen_nombre, LEFT(a.Clave_Articulo, 5) as linea, COUNT(DISTINCT a.Clave_Articulo) as total 
                            FROM articulo a
                            JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                            JOIN almacenes alm ON aa.Almacen = alm.Almacen
                            WHERE 1=1
                        `
                        if (filters?.only_active) remoteQuery += ` AND a.Habilitado = 1`;
                        remoteQuery += ` GROUP BY aa.Almacen, alm.Nombre, linea`;
                        
                        remoteData = await cm.executeQuery<any>(branch.id, remoteQuery)
                    } else {
                        throw err
                    }
                }

                // Obtener conteos por bodega y línea (local)
                const [localData] = await this.pool.execute<RowDataPacket[]>(
                    `SELECT c.almacen, LEFT(cd.item_code, 5) as linea, COUNT(DISTINCT cd.item_code) as counted
           FROM count_details cd
           JOIN counts c ON cd.count_id = c.id
           WHERE c.branch_id = ? AND c.status IN ('contado', 'cerrado')
           GROUP BY c.almacen, linea`,
                    [branch.id]
                )

                // Estructurar jerarquía
                const warehouseMap = new Map<string, any>()

                // Inicializar con datos remotos
                remoteData.forEach((row: any) => {
                    if (!warehouseMap.has(row.almacen_id)) {
                        warehouseMap.set(row.almacen_id, {
                            id: `${branch.id}-${row.almacen_id}`,
                            name: row.almacen_nombre || `Bodega ${row.almacen_id}`,
                            total: 0,
                            counted: 0,
                            lines: new Map()
                        })
                    }
                    const wh = warehouseMap.get(row.almacen_id)
                    wh.total += row.total

                    if (!wh.lines.has(row.linea)) {
                        wh.lines.set(row.linea, { name: row.linea, total: 0, counted: 0 })
                    }
                    wh.lines.get(row.linea).total += row.total
                })

                // Cruzar con datos locales
                localData.forEach((row: any) => {
                    const wh = warehouseMap.get(row.almacen)
                    if (wh) {
                        wh.counted += row.counted
                        const line = wh.lines.get(row.linea)
                        if (line) {
                            line.counted += row.counted
                        }
                    }
                })

                const branchTotal = Array.from(warehouseMap.values()).reduce((sum, w) => sum + w.total, 0)
                const branchCounted = Array.from(warehouseMap.values()).reduce((sum, w) => sum + w.counted, 0)

                results.push({
                    id: branch.id,
                    name: branch.name,
                    total_items: branchTotal,
                    counted_items: branchCounted,
                    percentage: branchTotal > 0 ? Number(Math.min(100, (branchCounted / branchTotal) * 100).toFixed(1)) : 0,
                    children: Array.from(warehouseMap.values()).map(w => ({
                        id: w.id,
                        name: `Bodega: ${w.name}`,
                        total_items: w.total,
                        counted_items: w.counted,
                        percentage: w.total > 0 ? Number(Math.min(100, (w.counted / w.total) * 100).toFixed(1)) : 0,
                        children: Array.from(w.lines.values() as any[]).map((l: any) => ({
                            id: `${w.id}-${l.name}`,
                            name: `Línea: ${l.name}`,
                            total_items: l.total,
                            counted_items: l.counted,
                            percentage: l.total > 0 ? Number(Math.min(100, (l.counted / l.total) * 100).toFixed(1)) : 0
                        })).sort((a, b) => b.total_items - a.total_items)
                    })).sort((a, b) => b.total_items - a.total_items)
                })
            } catch (err) {
                logger.error(`Error generating coverage report for branch ${branch.id}:`, err)
            }
        }

        return results
    }

    /**
     * Estadísticas de líneas (Más contadas y con mayor diferencia)
     */
    async getLineStats(filters: { branch_id?: number, date_from?: string, date_to?: string }) {
        let query = `
      SELECT 
        LEFT(cd.item_code, 5) as linea,
        COUNT(*) as total_counts,
        SUM(ABS(cd.difference)) as total_diff
      FROM count_details cd
      JOIN counts c ON cd.count_id = c.id
      WHERE (c.status = 'cerrado' OR c.status = 'contado')
    `
        const params: any[] = []

        if (filters.branch_id) {
            query += ' AND c.branch_id = ?'
            params.push(filters.branch_id)
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?'
            params.push(filters.date_from)
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?'
            params.push(filters.date_to)
        }

        query += ' GROUP BY linea'

        const [rows] = await this.pool.execute<RowDataPacket[]>(query, params)

        const topCounted = [...rows]
            .sort((a: any, b: any) => b.total_counts - a.total_counts)
            .slice(0, 5)
            .map((r: any) => ({ name: r.linea, value: r.total_counts }))

        const topDiff = [...rows]
            .sort((a: any, b: any) => b.total_diff - a.total_diff)
            .slice(0, 5)
            .map((r: any) => ({ name: r.linea, value: r.total_diff }))

        return { topCounted, topDiff }
    }

    /**
     * Obtiene estadísticas de productividad por usuario
     */
    async getProductivityStats(filters: { branch_id?: number, classification?: string, responsible_user_id?: number, date_from?: string, date_to?: string }) {
        const params: any[] = []
        let whereClause = ''

        if (filters.branch_id) {
            whereClause += ' AND c.branch_id = ?'
            params.push(filters.branch_id)
        }
        if (filters.classification) {
            whereClause += ' AND c.classification = ?'
            params.push(filters.classification)
        }
        if (filters.responsible_user_id) {
            whereClause += ' AND c.responsible_user_id = ?'
            params.push(filters.responsible_user_id)
        }
        if (filters.date_from) {
            whereClause += ' AND c.created_at >= ?'
            params.push(filters.date_from)
        }
        if (filters.date_to) {
            whereClause += ' AND c.created_at <= ?'
            params.push(filters.date_to)
        }

        // 1. Surtidores (Artículos contados)
        const surtidoresQuery = `
            SELECT u.name, COUNT(cd.id) as value
            FROM count_details cd
            JOIN counts c ON cd.count_id = c.id
            JOIN users u ON cd.counted_by_user_id = u.id
            WHERE cd.counted_at IS NOT NULL ${whereClause}
            GROUP BY u.id
            ORDER BY value DESC
            LIMIT 10
        `
        const [topSurtidores] = await this.pool.execute<RowDataPacket[] | any[]>(surtidoresQuery, params)

        // 2. Solicitantes de ajustes
        const solicitantesQuery = `
            SELECT u.name, COUNT(r.id) as value
            FROM requests r
            JOIN counts c ON r.count_id = c.id
            JOIN users u ON r.requested_by_user_id = u.id
            WHERE 1=1 ${whereClause.replace(/c\./g, 'c.')}
            GROUP BY u.id
            ORDER BY value DESC
            LIMIT 10
        `
        const [topSolicitantes] = await this.pool.execute<RowDataPacket[] | any[]>(solicitantesQuery, params)

        // 3. Revisores de ajustes
        const revisoresQuery = `
            SELECT u.name, COUNT(r.id) as value
            FROM requests r
            JOIN counts c ON r.count_id = c.id
            JOIN users u ON r.reviewed_by_user_id = u.id
            WHERE r.status != 'pendiente' ${whereClause}
            GROUP BY u.id
            ORDER BY value DESC
            LIMIT 10
        `
        const [topRevisores] = await this.pool.execute<RowDataPacket[] | any[]>(revisoresQuery, params)

        return {
            topSurtidores,
            topSolicitantes,
            topRevisores
        }
    }

    /**
     * Obtiene el reporte de ajustes (diferencias) valorizadas
     */
    async getAdjustmentsReport(filters: { branch_id?: number, date_from?: string, date_to?: string }): Promise<any[]> {
        const params: any[] = []
        let query = `
            SELECT 
                c.branch_id,
                b.name as branch_name,
                LEFT(cd.item_code, 5) as linea,
                cd.item_code,
                SUM(CASE WHEN cd.difference > 0 THEN cd.difference ELSE 0 END) as diff_positive,
                SUM(CASE WHEN cd.difference < 0 THEN ABS(cd.difference) ELSE 0 END) as diff_negative
            FROM count_details cd
            JOIN counts c ON cd.count_id = c.id
            JOIN branches b ON c.branch_id = b.id
            WHERE c.classification = 'inventario' 
              AND (c.status = 'cerrado' OR c.status = 'contado')
        `
        
        if (filters.branch_id) {
            query += ' AND c.branch_id = ?'
            params.push(filters.branch_id)
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?'
            params.push(filters.date_from)
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?'
            params.push(filters.date_to)
        }
        
        query += ' GROUP BY c.branch_id, branch_name, linea, cd.item_code HAVING diff_positive > 0 OR diff_negative > 0'
        
        const [rows] = await this.pool.execute<RowDataPacket[]>(query, params)
        
        if (rows.length === 0) return []

        const cm = ConnectionManager.getInstance()
        const results: any[] = []

        const byBranch = new Map<number, any[]>()
        for (const row of rows) {
            if (!byBranch.has(row.branch_id)) byBranch.set(row.branch_id, [])
            byBranch.get(row.branch_id)!.push(row)
        }

        for (const [branchId, branchRows] of byBranch.entries()) {
            const itemCodes = branchRows.map((r: any) => `'${r.item_code}'`).join(',')
            let remoteCosts = new Map<string, number>()
            
            try {
                const remoteQuery = `
                    SELECT Clave_Articulo, MAX(Costo_Promedio) as costo
                    FROM articuloalm
                    WHERE Clave_Articulo IN (${itemCodes})
                    GROUP BY Clave_Articulo
                `
                const remoteData = await cm.executeQuery<any>(branchId, remoteQuery)
                
                for (const row of remoteData) {
                    remoteCosts.set(row.Clave_Articulo, Number(row.costo) || 0)
                }
            } catch (err: any) {
                logger.error(`Error fetching remote costs for branch ${branchId}:`, err)
            }

            for (const row of branchRows) {
                const cost = remoteCosts.get(row.item_code) || 0
                results.push({
                    branch_id: row.branch_id,
                    branch_name: row.branch_name,
                    line: row.linea,
                    item_code: row.item_code,
                    qty_positive: Number(row.diff_positive),
                    amount_positive: Number(row.diff_positive) * cost,
                    qty_negative: Number(row.diff_negative),
                    amount_negative: Number(row.diff_negative) * cost,
                    unit_cost: cost
                })
            }
        }

        return results
    }

    /**
     * Obtiene el reporte de tiempos de respuesta por prioridad
     */
    async getPriorityTimesReport(filters: { branch_id?: number, classification?: string, responsible_user_id?: number, date_from?: string, date_to?: string }) {
        // 1. Obtener conteos asignados e iniciados para calcular el tiempo de inicio
        let countsQuery = `
            SELECT 
                c.id, 
                c.folio, 
                c.priority, 
                c.classification,
                c.created_at, 
                c.assigned_at, 
                c.started_at, 
                c.finished_at,
                c.closed_at,
                b.name as branch_name,
                u.name as responsible_name
            FROM counts c
            JOIN branches b ON c.branch_id = b.id
            LEFT JOIN users u ON c.responsible_user_id = u.id
            WHERE c.assigned_at IS NOT NULL AND c.started_at IS NOT NULL
        `
        const countsParams: any[] = []

        if (filters.branch_id) {
            countsQuery += ' AND c.branch_id = ?'
            countsParams.push(filters.branch_id)
        }
        if (filters.classification) {
            countsQuery += ' AND c.classification = ?'
            countsParams.push(filters.classification)
        }
        if (filters.responsible_user_id) {
            countsQuery += ' AND c.responsible_user_id = ?'
            countsParams.push(filters.responsible_user_id)
        }
        if (filters.date_from) {
            countsQuery += ' AND c.created_at >= ?'
            countsParams.push(filters.date_from)
        }
        if (filters.date_to) {
            countsQuery += ' AND c.created_at <= ?'
            countsParams.push(filters.date_to)
        }

        countsQuery += ' ORDER BY c.created_at DESC'
        const [countsRows] = await this.pool.execute<RowDataPacket[]>(countsQuery, countsParams)

        // 2. Obtener solicitudes resueltas para calcular el tiempo de resolución
        let requestsQuery = `
            SELECT 
                r.id,
                r.folio as request_folio,
                c.folio as count_folio,
                c.priority,
                c.classification,
                r.created_at as request_created_at,
                r.reviewed_at,
                b.name as branch_name,
                u.name as reviewer_name
            FROM requests r
            JOIN counts c ON r.count_id = c.id
            JOIN branches b ON c.branch_id = b.id
            LEFT JOIN users u ON r.reviewed_by_user_id = u.id
            WHERE r.reviewed_at IS NOT NULL
        `
        const requestsParams: any[] = []

        if (filters.branch_id) {
            requestsQuery += ' AND c.branch_id = ?'
            requestsParams.push(filters.branch_id)
        }
        if (filters.classification) {
            requestsQuery += ' AND c.classification = ?'
            requestsParams.push(filters.classification)
        }
        if (filters.responsible_user_id) {
            requestsQuery += ' AND c.responsible_user_id = ?'
            requestsParams.push(filters.responsible_user_id)
        }
        if (filters.date_from) {
            requestsQuery += ' AND c.created_at >= ?'
            requestsParams.push(filters.date_from)
        }
        if (filters.date_to) {
            requestsQuery += ' AND c.created_at <= ?'
            requestsParams.push(filters.date_to)
        }

        requestsQuery += ' ORDER BY r.created_at DESC'
        const [requestsRows] = await this.pool.execute<RowDataPacket[]>(requestsQuery, requestsParams)

        // 3. Procesar datos de conteos
        const priorityStats = {
            baja: { start_total_min: 0, start_count: 0, res_total_min: 0, res_count: 0 },
            media: { start_total_min: 0, start_count: 0, res_total_min: 0, res_count: 0 },
            alta: { start_total_min: 0, start_count: 0, res_total_min: 0, res_count: 0 },
            urgente: { start_total_min: 0, start_count: 0, res_total_min: 0, res_count: 0 },
            mostrador: { start_total_min: 0, start_count: 0, res_total_min: 0, res_count: 0 }
        }

        const countsDetail = countsRows.map((row: any) => {
            const assigned = new Date(row.assigned_at)
            const started = new Date(row.started_at)
            const elapsed = TimeUtils.getNetWorkingMinutes(assigned, started)
            
            const prio = (row.priority || 'media').toLowerCase() as keyof typeof priorityStats
            if (priorityStats[prio]) {
                priorityStats[prio].start_total_min += elapsed
                priorityStats[prio].start_count += 1
            }

            return {
                id: row.id,
                folio: row.folio,
                priority: row.priority || 'media',
                classification: row.classification,
                branch_name: row.branch_name,
                responsible_name: row.responsible_name || 'Sin asignar',
                assigned_at: row.assigned_at,
                started_at: row.started_at,
                elapsed_minutes: elapsed,
                elapsed_formatted: TimeUtils.formatDuration(elapsed)
            }
        })

        // 4. Procesar datos de solicitudes
        const requestsDetail = requestsRows.map((row: any) => {
            const created = new Date(row.request_created_at)
            const reviewed = new Date(row.reviewed_at)
            const elapsed = TimeUtils.getNetWorkingMinutes(created, reviewed)

            const prio = (row.priority || 'media').toLowerCase() as keyof typeof priorityStats
            if (priorityStats[prio]) {
                priorityStats[prio].res_total_min += elapsed
                priorityStats[prio].res_count += 1
            }

            return {
                id: row.id,
                request_folio: row.request_folio,
                count_folio: row.count_folio,
                priority: row.priority || 'media',
                classification: row.classification,
                branch_name: row.branch_name,
                reviewer_name: row.reviewer_name || 'Sistema',
                created_at: row.request_created_at,
                reviewed_at: row.reviewed_at,
                elapsed_minutes: elapsed,
                elapsed_formatted: TimeUtils.formatDuration(elapsed)
            }
        })

        // 5. Compilar resumen agrupado por prioridad
        const summary = Object.keys(priorityStats).map((prio) => {
            const stats = priorityStats[prio as keyof typeof priorityStats]
            return {
                priority: prio,
                avg_start_minutes: stats.start_count > 0 ? Math.floor(stats.start_total_min / stats.start_count) : 0,
                avg_start_formatted: TimeUtils.formatDuration(stats.start_count > 0 ? Math.floor(stats.start_total_min / stats.start_count) : 0),
                count_start: stats.start_count,
                avg_resolution_minutes: stats.res_count > 0 ? Math.floor(stats.res_total_min / stats.res_count) : 0,
                avg_resolution_formatted: TimeUtils.formatDuration(stats.res_count > 0 ? Math.floor(stats.res_total_min / stats.res_count) : 0),
                count_resolution: stats.res_count
            }
        })

        return {
            summary,
            counts: countsDetail,
            requests: requestsDetail
        }
    }

    /**
     * Reporte de Diferencias masivas (bulk_requests): resumen por estatus/sucursal/prioridad,
     * tiempos de resolución, ranking de usuarios y detalle de archivos adjuntos.
     */
    async getBulkRequestsReport(filters: { branch_id?: number, status?: string, date_from?: string, date_to?: string }) {
        const BULK_STATUSES = ['pendiente', 'en_revision', 'ajustado', 'rechazado'] as const

        const buildWhere = (alias: string, params: any[]): string => {
            let clause = ' WHERE 1=1'
            if (filters.branch_id) {
                clause += ` AND ${alias}.branch_id = ?`
                params.push(filters.branch_id)
            }
            if (filters.status) {
                clause += ` AND ${alias}.status = ?`
                params.push(filters.status)
            }
            if (filters.date_from) {
                clause += ` AND ${alias}.created_at >= ?`
                params.push(filters.date_from)
            }
            if (filters.date_to) {
                clause += ` AND ${alias}.created_at <= ?`
                params.push(filters.date_to)
            }
            return clause
        }

        // --- Resumen por estatus ---
        const statusParams: any[] = []
        const [statusRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT status, COUNT(*) as total FROM bulk_requests${buildWhere('bulk_requests', statusParams)} GROUP BY status`,
            statusParams
        )
        const by_status: Record<string, number> = { pendiente: 0, en_revision: 0, ajustado: 0, rechazado: 0 }
        let total = 0
        for (const row of statusRows) {
            by_status[row.status] = Number(row.total)
            total += Number(row.total)
        }

        // --- Resumen por prioridad ---
        const priorityParams: any[] = []
        const [priorityRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT priority, COUNT(*) as total FROM bulk_requests${buildWhere('bulk_requests', priorityParams)} GROUP BY priority`,
            priorityParams
        )
        const by_priority = priorityRows.map((row) => ({ priority: row.priority, total: Number(row.total) }))

        // --- Resumen por sucursal (pivot estatus) ---
        const branchParams: any[] = []
        const [branchRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT br.branch_id, b.name as branch_name, br.status, COUNT(*) as total
             FROM bulk_requests br
             JOIN branches b ON br.branch_id = b.id
             ${buildWhere('br', branchParams)}
             GROUP BY br.branch_id, b.name, br.status`,
            branchParams
        )
        const byBranchMap = new Map<number, any>()
        for (const row of branchRows) {
            if (!byBranchMap.has(row.branch_id)) {
                byBranchMap.set(row.branch_id, {
                    branch_id: row.branch_id,
                    branch_name: row.branch_name,
                    pendiente: 0,
                    en_revision: 0,
                    ajustado: 0,
                    rechazado: 0,
                    total: 0
                })
            }
            const entry = byBranchMap.get(row.branch_id)
            entry[row.status as typeof BULK_STATUSES[number]] = Number(row.total)
            entry.total += Number(row.total)
        }
        const by_branch = Array.from(byBranchMap.values()).sort((a, b) => b.total - a.total)

        // --- Tiempos de resolución ---
        const resOverallParams: any[] = []
        const resOverallWhere = buildWhere('bulk_requests', resOverallParams) +
            " AND status IN ('ajustado', 'rechazado') AND reviewed_at IS NOT NULL"
        const [resOverallRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, reviewed_at)) as avg_hours, COUNT(*) as resolved_count
             FROM bulk_requests${resOverallWhere}`,
            resOverallParams
        )
        const overall_avg_hours = resOverallRows[0]?.avg_hours != null ? Number(resOverallRows[0].avg_hours) : null

        const resBranchParams: any[] = []
        const resBranchWhere = buildWhere('br', resBranchParams) +
            " AND br.status IN ('ajustado', 'rechazado') AND br.reviewed_at IS NOT NULL"
        const [resBranchRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT br.branch_id, b.name as branch_name,
                    AVG(TIMESTAMPDIFF(HOUR, br.created_at, br.reviewed_at)) as avg_hours,
                    COUNT(*) as resolved_count
             FROM bulk_requests br
             JOIN branches b ON br.branch_id = b.id
             ${resBranchWhere}
             GROUP BY br.branch_id, b.name`,
            resBranchParams
        )
        const resolution_by_branch = resBranchRows.map((row) => ({
            branch_id: row.branch_id,
            branch_name: row.branch_name,
            avg_hours: Number(row.avg_hours),
            resolved_count: Number(row.resolved_count)
        }))

        const resReviewerParams: any[] = []
        const resReviewerWhere = buildWhere('br', resReviewerParams) +
            " AND br.status IN ('ajustado', 'rechazado') AND br.reviewed_at IS NOT NULL AND br.reviewed_by_user_id IS NOT NULL"
        const [resReviewerRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT br.reviewed_by_user_id as user_id, u.name as user_name,
                    AVG(TIMESTAMPDIFF(HOUR, br.created_at, br.reviewed_at)) as avg_hours,
                    COUNT(*) as resolved_count
             FROM bulk_requests br
             JOIN users u ON br.reviewed_by_user_id = u.id
             ${resReviewerWhere}
             GROUP BY br.reviewed_by_user_id, u.name
             ORDER BY avg_hours ASC`,
            resReviewerParams
        )
        const resolution_by_reviewer = resReviewerRows.map((row) => ({
            user_id: row.user_id,
            user_name: row.user_name,
            avg_hours: Number(row.avg_hours),
            resolved_count: Number(row.resolved_count)
        }))

        // --- Ranking de usuarios ---
        const reqParams: any[] = []
        const [requesterRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT br.requested_by_user_id as user_id, u.name as user_name, COUNT(*) as total
             FROM bulk_requests br
             JOIN users u ON br.requested_by_user_id = u.id
             ${buildWhere('br', reqParams)}
             GROUP BY br.requested_by_user_id, u.name
             ORDER BY total DESC
             LIMIT 10`,
            reqParams
        )
        const top_requesters = requesterRows.map((row) => ({
            user_id: row.user_id,
            user_name: row.user_name,
            total: Number(row.total)
        }))

        const revParams: any[] = []
        const revWhere = buildWhere('br', revParams) + ' AND br.reviewed_by_user_id IS NOT NULL'
        const [reviewerRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT br.reviewed_by_user_id as user_id, u.name as user_name, COUNT(*) as total
             FROM bulk_requests br
             JOIN users u ON br.reviewed_by_user_id = u.id
             ${revWhere}
             GROUP BY br.reviewed_by_user_id, u.name
             ORDER BY total DESC
             LIMIT 10`,
            revParams
        )
        const top_reviewers = reviewerRows.map((row) => ({
            user_id: row.user_id,
            user_name: row.user_name,
            total: Number(row.total)
        }))

        // --- Archivos: total, descargas, nunca descargados, top descargados ---
        const filesParams: any[] = []
        const [fileRows] = await this.pool.execute<RowDataPacket[]>(
            `SELECT f.id as file_id, f.original_name, br.folio, COUNT(d.id) as download_count
             FROM bulk_request_files f
             JOIN bulk_requests br ON f.bulk_request_id = br.id
             LEFT JOIN bulk_request_file_downloads d ON d.bulk_request_file_id = f.id
             ${buildWhere('br', filesParams)}
             GROUP BY f.id, f.original_name, br.folio
             ORDER BY download_count DESC`,
            filesParams
        )
        const allFiles = fileRows.map((row) => ({
            file_id: row.file_id,
            original_name: row.original_name,
            folio: row.folio,
            download_count: Number(row.download_count)
        }))
        const total_files = allFiles.length
        const total_downloads = allFiles.reduce((sum, f) => sum + f.download_count, 0)
        const never_downloaded_count = allFiles.filter((f) => f.download_count === 0).length
        const top_files = allFiles.slice(0, 10)

        return {
            summary: { total, by_status, by_branch, by_priority },
            resolution: { overall_avg_hours, by_branch: resolution_by_branch, by_reviewer: resolution_by_reviewer },
            users: { top_requesters, top_reviewers },
            files: { total_files, total_downloads, never_downloaded_count, top_files }
        }
    }
}

export const reportsService = new ReportsService()
export default reportsService
