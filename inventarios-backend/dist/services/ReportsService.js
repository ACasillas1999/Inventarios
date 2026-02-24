"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsService = exports.ReportsService = void 0;
const database_1 = require("../config/database");
const TimeUtils_1 = require("../utils/TimeUtils");
const ConnectionManager_1 = require("../connections/ConnectionManager");
const logger_1 = require("../utils/logger");
class ReportsService {
    pool = (0, database_1.getLocalPool)();
    /**
     * Obtiene métricas de auditoría y tiempos de respuesta
     */
    async getAuditKPIs(filters) {
        let query = `
      SELECT 
        c.id, c.folio, c.created_at, c.assigned_at, c.started_at, c.finished_at, c.closed_at,
        u.name as responsible_name,
        creator.name as created_by_name
      FROM counts c
      LEFT JOIN users u ON c.responsible_user_id = u.id
      LEFT JOIN users creator ON c.created_by_user_id = creator.id
      WHERE (c.status = 'cerrado' OR c.status = 'contado')
    `;
        const params = [];
        if (filters.branch_id) {
            query += ' AND c.branch_id = ?';
            params.push(filters.branch_id);
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?';
            params.push(filters.date_to);
        }
        const [rows] = await this.pool.execute(query, params);
        let totalAssignMin = 0;
        let countAssign = 0;
        let totalStartMin = 0;
        let countStart = 0;
        const userStats = new Map();
        const assignmentStats = new Map();
        rows.forEach((row) => {
            const created = new Date(row.created_at);
            const assigned = row.assigned_at ? new Date(row.assigned_at) : null;
            const started = row.started_at ? new Date(row.started_at) : null;
            // KPI 1: Tiempo de reasignación/asignación (Jefe -> Surtidor)
            if (assigned) {
                const min = TimeUtils_1.TimeUtils.getNetWorkingMinutes(created, assigned);
                totalAssignMin += min;
                countAssign++;
                // Track by created_by user (quien creó/asignó el conteo)
                if (row.created_by_name) {
                    const u = assignmentStats.get(row.created_by_name) || { total_assign_min: 0, count_assign: 0 };
                    u.total_assign_min += min;
                    u.count_assign++;
                    assignmentStats.set(row.created_by_name, u);
                }
            }
            // KPI 2: Tiempo de inicio (Surtidor recibe -> Surtidor inicia)
            if (assigned && started) {
                const min = TimeUtils_1.TimeUtils.getNetWorkingMinutes(assigned, started);
                totalStartMin += min;
                countStart++;
                if (row.responsible_name) {
                    const u = userStats.get(row.responsible_name) || { total_start_min: 0, count_start: 0 };
                    u.total_start_min += min;
                    u.count_start++;
                    userStats.set(row.responsible_name, u);
                }
            }
        });
        // KPI 3: Resolución de solicitudes (Entradas Inventarios)
        const [reqRows] = await this.pool.execute(`SELECT r.created_at, r.reviewed_at, u.name as reviewer_name 
       FROM requests r
       LEFT JOIN users u ON r.reviewed_by_user_id = u.id
       WHERE r.status != 'pendiente'`);
        let totalResMin = 0;
        let countRes = 0;
        const resolutionStats = new Map();
        reqRows.forEach((r) => {
            if (r.created_at && r.reviewed_at) {
                const min = TimeUtils_1.TimeUtils.getNetWorkingMinutes(new Date(r.created_at), new Date(r.reviewed_at));
                totalResMin += min;
                countRes++;
                if (r.reviewer_name) {
                    const u = resolutionStats.get(r.reviewer_name) || { total_res_min: 0, count_res: 0 };
                    u.total_res_min += min;
                    u.count_res++;
                    resolutionStats.set(r.reviewer_name, u);
                }
            }
        });
        return {
            avg_assignment_time: TimeUtils_1.TimeUtils.formatDuration(countAssign > 0 ? Math.floor(totalAssignMin / countAssign) : 0),
            avg_start_time: TimeUtils_1.TimeUtils.formatDuration(countStart > 0 ? Math.floor(totalStartMin / countStart) : 0),
            avg_resolution_time: TimeUtils_1.TimeUtils.formatDuration(countRes > 0 ? Math.floor(totalResMin / countRes) : 0),
            efficiency_by_user: Array.from(userStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_start_min / stats.count_start),
                avg_formatted: TimeUtils_1.TimeUtils.formatDuration(Math.floor(stats.total_start_min / stats.count_start))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes),
            assignment_by_user: Array.from(assignmentStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_assign_min / stats.count_assign),
                avg_formatted: TimeUtils_1.TimeUtils.formatDuration(Math.floor(stats.total_assign_min / stats.count_assign))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes),
            resolution_by_user: Array.from(resolutionStats.entries()).map(([name, stats]) => ({
                name,
                avg_minutes: Math.floor(stats.total_res_min / stats.count_res),
                avg_formatted: TimeUtils_1.TimeUtils.formatDuration(Math.floor(stats.total_res_min / stats.count_res))
            })).sort((a, b) => a.avg_minutes - b.avg_minutes)
        };
    }
    /**
     * Obtiene una vista general de la empresa
     */
    async getCompanyOverview() {
        const cm = ConnectionManager_1.ConnectionManager.getInstance();
        const branches = cm.getAllBranchConfigs();
        let totalItems = 0;
        let totalCounted = 0;
        const branchStats = [];
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
                let remoteCount;
                try {
                    [remoteCount] = await cm.executeQuery(branch.id, query);
                }
                catch (err) {
                    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.sqlState === '42S22') {
                        query = `
                            SELECT COUNT(DISTINCT a.Clave_Articulo) as total 
                            FROM articulo a
                            JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                            JOIN almacenes alm ON aa.Almacen = alm.Almacen
                        `[remoteCount] = await cm.executeQuery(branch.id, query);
                    }
                    else {
                        throw err;
                    }
                }
                const branchTotal = remoteCount?.total || 0;
                totalItems += branchTotal;
                // 2. Obtener artículos contados en esta sucursal (local)
                const [localCount] = await this.pool.execute(`SELECT COUNT(DISTINCT cd.item_code) as counted 
           FROM count_details cd
           JOIN counts c ON cd.count_id = c.id
           WHERE c.branch_id = ? AND c.status IN ('contado', 'cerrado')`, [branch.id]);
                const branchCounted = localCount[0]?.counted || 0;
                totalCounted += branchCounted;
                branchStats.push({
                    name: branch.name,
                    percentage: branchTotal > 0 ? Number(((branchCounted / branchTotal) * 100).toFixed(1)) : 0
                });
            }
            catch (err) {
                logger_1.logger.error(`Error calculating company overview for branch ${branch.id}:`, err);
            }
        }
        return {
            total_items: totalItems,
            counted_items: totalCounted,
            coverage_percentage: totalItems > 0 ? Number(((totalCounted / totalItems) * 100).toFixed(1)) : 0,
            branch_stats: branchStats
        };
    }
    /**
     * Obtiene el reporte de cobertura jerárquico
     */
    async getCoverageReport(branchId) {
        const cm = ConnectionManager_1.ConnectionManager.getInstance();
        const branches = branchId
            ? cm.getAllBranchConfigs().filter(b => b.id === branchId)
            : cm.getAllBranchConfigs();
        const results = [];
        for (const branch of branches) {
            try {
                // Obtener datos por bodega y línea (remoto)
                let remoteQuery = `
                    SELECT aa.Almacen as almacen_id, alm.Nombre as almacen_nombre, LEFT(a.Clave_Articulo, 5) as linea, COUNT(DISTINCT a.Clave_Articulo) as total 
                    FROM articulo a
                    JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                    JOIN almacenes alm ON aa.Almacen = alm.Almacen
                    WHERE alm.Habilitado = 1
                    GROUP BY aa.Almacen, alm.Nombre, linea
                `;
                let remoteData;
                try {
                    remoteData = await cm.executeQuery(branch.id, remoteQuery);
                }
                catch (err) {
                    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.sqlState === '42S22') {
                        remoteQuery = `
                            SELECT aa.Almacen as almacen_id, alm.Nombre as almacen_nombre, LEFT(a.Clave_Articulo, 5) as linea, COUNT(DISTINCT a.Clave_Articulo) as total 
                            FROM articulo a
                            JOIN articuloalm aa ON a.Clave_Articulo = aa.Clave_Articulo
                            JOIN almacenes alm ON aa.Almacen = alm.Almacen
                            GROUP BY aa.Almacen, alm.Nombre, linea
                        `;
                        remoteData = await cm.executeQuery(branch.id, remoteQuery);
                    }
                    else {
                        throw err;
                    }
                }
                // Obtener conteos por bodega y línea (local)
                const [localData] = await this.pool.execute(`SELECT c.almacen, LEFT(cd.item_code, 5) as linea, COUNT(DISTINCT cd.item_code) as counted
           FROM count_details cd
           JOIN counts c ON cd.count_id = c.id
           WHERE c.branch_id = ? AND c.status IN ('contado', 'cerrado')
           GROUP BY c.almacen, linea`, [branch.id]);
                // Estructurar jerarquía
                const warehouseMap = new Map();
                // Inicializar con datos remotos
                remoteData.forEach((row) => {
                    if (!warehouseMap.has(row.almacen_id)) {
                        warehouseMap.set(row.almacen_id, {
                            id: `${branch.id}-${row.almacen_id}`,
                            name: row.almacen_nombre || `Bodega ${row.almacen_id}`,
                            total: 0,
                            counted: 0,
                            lines: new Map()
                        });
                    }
                    const wh = warehouseMap.get(row.almacen_id);
                    wh.total += row.total;
                    if (!wh.lines.has(row.linea)) {
                        wh.lines.set(row.linea, { name: row.linea, total: 0, counted: 0 });
                    }
                    wh.lines.get(row.linea).total += row.total;
                });
                // Cruzar con datos locales
                localData.forEach((row) => {
                    const wh = warehouseMap.get(row.almacen);
                    if (wh) {
                        wh.counted += row.counted;
                        const line = wh.lines.get(row.linea);
                        if (line) {
                            line.counted += row.counted;
                        }
                    }
                });
                const branchTotal = Array.from(warehouseMap.values()).reduce((sum, w) => sum + w.total, 0);
                const branchCounted = Array.from(warehouseMap.values()).reduce((sum, w) => sum + w.counted, 0);
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
                        children: Array.from(w.lines.values()).map((l) => ({
                            id: `${w.id}-${l.name}`,
                            name: `Línea: ${l.name}`,
                            total_items: l.total,
                            counted_items: l.counted,
                            percentage: l.total > 0 ? Number(Math.min(100, (l.counted / l.total) * 100).toFixed(1)) : 0
                        })).sort((a, b) => b.total_items - a.total_items)
                    })).sort((a, b) => b.total_items - a.total_items)
                });
            }
            catch (err) {
                logger_1.logger.error(`Error generating coverage report for branch ${branch.id}:`, err);
            }
        }
        return results;
    }
    /**
     * Estadísticas de líneas (Más contadas y con mayor diferencia)
     */
    async getLineStats(filters) {
        let query = `
      SELECT 
        LEFT(cd.item_code, 5) as linea,
        COUNT(*) as total_counts,
        SUM(ABS(cd.difference)) as total_diff
      FROM count_details cd
      JOIN counts c ON cd.count_id = c.id
      WHERE (c.status = 'cerrado' OR c.status = 'contado')
    `;
        const params = [];
        if (filters.branch_id) {
            query += ' AND c.branch_id = ?';
            params.push(filters.branch_id);
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?';
            params.push(filters.date_to);
        }
        query += ' GROUP BY linea';
        const [rows] = await this.pool.execute(query, params);
        const topCounted = [...rows]
            .sort((a, b) => b.total_counts - a.total_counts)
            .slice(0, 5)
            .map((r) => ({ name: r.linea, value: r.total_counts }));
        const topDiff = [...rows]
            .sort((a, b) => b.total_diff - a.total_diff)
            .slice(0, 5)
            .map((r) => ({ name: r.linea, value: r.total_diff }));
        return { topCounted, topDiff };
    }
    /**
     * Obtiene estadísticas de productividad por usuario
     */
    async getProductivityStats(filters) {
        const params = [];
        let whereClause = '';
        if (filters.branch_id) {
            whereClause += ' AND c.branch_id = ?';
            params.push(filters.branch_id);
        }
        if (filters.date_from) {
            whereClause += ' AND c.created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            whereClause += ' AND c.created_at <= ?';
            params.push(filters.date_to);
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
        `;
        const [topSurtidores] = await this.pool.execute(surtidoresQuery, params);
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
        `;
        const [topSolicitantes] = await this.pool.execute(solicitantesQuery, params);
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
        `;
        const [topRevisores] = await this.pool.execute(revisoresQuery, params);
        return {
            topSurtidores,
            topSolicitantes,
            topRevisores
        };
    }
}
exports.ReportsService = ReportsService;
exports.reportsService = new ReportsService();
exports.default = exports.reportsService;
//# sourceMappingURL=ReportsService.js.map