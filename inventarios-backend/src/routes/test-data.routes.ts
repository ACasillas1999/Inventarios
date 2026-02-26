import { Router, Response } from 'express';
import { ConnectionManager } from '../connections/ConnectionManager';
import { getLocalPool } from '../config/database';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';

const router = Router();

// Middleware para verificar que solo admins puedan usar estos endpoints
const requireAdmin = (req: AuthRequest, res: Response, next: any): void => {
    logger.info(`Checking admin permissions for user: ${JSON.stringify(req.user)}`);
    if (!req.user) {
        logger.warn('No user in request');
        res.status(401).json({ error: 'No autenticado.' });
        return;
    }
    // Asumimos que role_id 1 es administrador
    if (req.user.role_id !== 1) {
        logger.warn(`Unauthorized access attempt to test-data by user ${req.user.id} with role_id ${req.user.role_id}`);
        res.status(403).json({ error: `Acceso denegado. Solo administradores (Tu role_id: ${req.user.role_id}).` });
        return;
    }
    next();
};

/**
 * Función auxiliar para obtener un pool de sucursal válido.
 * Intenta con el ID proporcionado, de lo contrario busca el primero disponible.
 */
function getAnyAvailablePool(connectionManager: ConnectionManager, preferredBranchId: number) {
    const statuses = connectionManager.getBranchesStatus();
    logger.info(`Available branches: ${JSON.stringify(statuses)}`);

    let pool = connectionManager.getPool(preferredBranchId);
    if (pool) return { pool, branchId: preferredBranchId };

    // Buscar el primero que esté conectado
    const firstConnected = statuses.find(s => s.status === 'connected');
    if (firstConnected) {
        logger.info(`Branch ${preferredBranchId} not found or error. Using branch ${firstConnected.id} instead.`);
        return { pool: connectionManager.getPool(firstConnected.id), branchId: firstConnected.id };
    }

    return { pool: null, branchId: null };
}

// GET /api/test-data/stats - Obtener estadísticas de datos de prueba
router.get('/stats', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
    logger.info('GET /api/test-data/stats requested');
    try {
        const localPool = getLocalPool();
        const connectionManager = ConnectionManager.getInstance();
        const { pool: branchPool, branchId } = getAnyAvailablePool(connectionManager, 1);

        if (!branchPool || !branchId) {
            logger.error('No connection pools available for any branch');
            res.status(500).json({ error: 'No se pudo conectar a ninguna base de datos de sucursal. Verifica las conexiones.' });
            return;
        }

        // 1. Contar artículos totales en la sucursal (Remoto)
        logger.debug(`Querying total articles from branch ${branchId}...`);
        let totalArticles = 0;
        try {
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM articulo') as any[];
            totalArticles = totalResult[0].total;
        } catch (e) {
            logger.warn('Failed to query "articulo" table, trying "Articulos"...');
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM Articulos') as any[];
            totalArticles = totalResult[0].total;
        }

        // 2. Contar artículos contados (Local)
        logger.debug(`Querying counted articles from local database for branch ${branchId}...`);
        const [countedResult] = await localPool.query(
            "SELECT COUNT(DISTINCT cd.item_code) as counted FROM count_details cd JOIN counts c ON cd.count_id = c.id WHERE c.branch_id = ?",
            [branchId]
        ) as any[];
        const countedArticles = countedResult[0].counted;

        // 3. Contar registros de prueba (Local)
        logger.debug(`Querying test records from local database for branch ${branchId}...`);
        const [testCountsResult] = await localPool.query(
            "SELECT COUNT(*) as test_counts FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?",
            [branchId]
        ) as any[];
        const testCounts = testCountsResult[0].test_counts;

        const [testDetailsResult] = await localPool.query(
            "SELECT COUNT(*) as test_details FROM count_details WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?)",
            [branchId]
        ) as any[];
        const testDetails = testDetailsResult[0].test_details;

        const coveragePercentage = totalArticles > 0
            ? ((countedArticles / totalArticles) * 100).toFixed(2)
            : '0.00';

        logger.info('Stats fetched successfully');
        res.json({
            branch_id: branchId,
            total_articles: totalArticles,
            counted_articles: countedArticles,
            coverage_percentage: parseFloat(coveragePercentage),
            test_counts: testCounts,
            test_details: testDetails,
            has_test_data: testCounts > 0
        });
    } catch (error: any) {
        logger.error('Error getting test data stats:', error);
        res.status(500).json({ error: `Error al obtener estadísticas: ${error.message}` });
    }
});

// POST /api/test-data/seed-coverage - Generar datos de prueba
router.post('/seed-coverage', authMiddleware, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
    logger.info('POST /api/test-data/seed-coverage requested');
    try {
        const user = req.user!;
        const localPool = getLocalPool();
        const connectionManager = ConnectionManager.getInstance();
        const { pool: branchPool, branchId } = getAnyAvailablePool(connectionManager, 1);

        if (!branchPool || !branchId) {
            res.status(500).json({ error: 'No se pudo conectar a ninguna base de datos de sucursal.' });
            return;
        }

        // Verificar si ya existen datos de prueba
        const [existing] = await localPool.query(
            "SELECT COUNT(*) as count FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?",
            [branchId]
        ) as any[];

        if (existing[0].count > 0) {
            res.status(400).json({
                error: 'Ya existen datos de prueba. Elimínalos primero antes de generar nuevos.'
            });
            return;
        }

        // Obtener estadísticas antes
        const [beforeCounted] = await localPool.query(
            "SELECT COUNT(DISTINCT item_code) as counted FROM count_details cd JOIN counts c ON cd.count_id = c.id WHERE c.branch_id = ?",
            [branchId]
        ) as any[];
        const beforeCount = beforeCounted[0].counted;

        // Crear conteo de prueba #1
        const [result1] = await localPool.query(
            `INSERT INTO counts (
                folio, branch_id, almacen, type, classification, status, priority,
                responsible_user_id, created_by_user_id, tolerance_percentage,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['TEST-COVERAGE-001', branchId, 1, 'total', 'inventario', 'contado', 'media', user.id, user.id, 5]
        ) as any[];

        const countId1 = result1.insertId;

        // Insertar 5000 artículos aleatorios desde el remoto al local
        logger.debug(`Fetching items from remote branch ${branchId} to seed...`);
        let itemsQuery = 'SELECT Clave_Articulo, Descripcion, IFNULL(Existencia_Fisica, 0) as stock, IFNULL(Unidad_Medida, "PZA") as unit FROM articulo ORDER BY RAND() LIMIT 5000';
        let items: any[] = [];
        try {
            const [rows] = await branchPool.query(itemsQuery) as any[];
            items = rows;
        } catch (e) {
            logger.warn('Failed to query "articulo" with "Unidad_Medida", trying "Unidad"...');
            itemsQuery = 'SELECT Clave_Articulo, Descripcion, IFNULL(Existencia_Fisica, 0) as stock, IFNULL(Unidad, "PZA") as unit FROM Articulos ORDER BY RAND() LIMIT 5000';
            const [rows] = await branchPool.query(itemsQuery) as any[];
            items = rows;
        }

        logger.debug(`Inserting ${items.length} items into local count_details...`);
        // Usar bulk insert para mayor velocidad y evitar timeouts
        if (items.length > 0) {
            const values = items.map(item => [
                countId1, item.Clave_Articulo, item.Descripcion, 1, 'Sucursal principal',
                item.stock, item.stock, item.unit || item.unit_measure || 'PZA', 0, 0, new Date(), new Date()
            ]);

            await localPool.query(
                `INSERT INTO count_details (
                    count_id, item_code, item_description, warehouse_id, warehouse_name,
                    system_stock, counted_stock, unit, difference, difference_percentage,
                    created_at, updated_at
                ) VALUES ?`,
                [values]
            );
        }

        // Crear conteo de prueba #2 con diferencias
        const [result2] = await localPool.query(
            `INSERT INTO counts (
                folio, branch_id, almacen, type, classification, status, priority,
                responsible_user_id, created_by_user_id, tolerance_percentage,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['TEST-COVERAGE-002', branchId, 1, 'ciclico', 'inventario', 'contado', 'alta', user.id, user.id, 5]
        ) as any[];

        const countId2 = result2.insertId;

        // Insertar 500 artículos con diferencias (que no estén en el anterior)
        const spawnedItems = items.map(i => i.Clave_Articulo);
        let diffItemsQuery = 'SELECT Clave_Articulo, Descripcion, IFNULL(Existencia_Fisica, 0) as stock, IFNULL(Unidad_Medida, "PZA") as unit FROM articulo WHERE Clave_Articulo NOT IN (?) ORDER BY RAND() LIMIT 500';
        let diffItems: any[] = [];
        try {
            const [rows] = await branchPool.query(diffItemsQuery, [spawnedItems.length > 0 ? spawnedItems : ['']]) as any[];
            diffItems = rows;
        } catch (e) {
            diffItemsQuery = 'SELECT Clave_Articulo, Descripcion, IFNULL(Existencia_Fisica, 0) as stock, IFNULL(Unidad, "PZA") as unit FROM Articulos WHERE Clave_Articulo NOT IN (?) ORDER BY RAND() LIMIT 500';
            const [rows] = await branchPool.query(diffItemsQuery, [spawnedItems.length > 0 ? spawnedItems : ['']]) as any[];
            diffItems = rows;
        }

        if (diffItems.length > 0) {
            const diffValues = diffItems.map(item => {
                const diff = Math.floor(Math.random() * 21) - 10;
                const counted = item.stock + diff;
                const diffPct = item.stock !== 0 ? (diff * 100 / item.stock) : 0;
                return [
                    countId2, item.Clave_Articulo, item.Descripcion, 1, 'Sucursal principal',
                    item.stock, counted, item.unit || item.unit_measure || 'PZA', diff, diffPct, new Date(), new Date()
                ];
            });

            await localPool.query(
                `INSERT INTO count_details (
                    count_id, item_code, item_description, warehouse_id, warehouse_name,
                    system_stock, counted_stock, unit, difference, difference_percentage,
                    created_at, updated_at
                ) VALUES ?`,
                [diffValues]
            );
        }

        // Obtener estadísticas después
        const [afterCounted] = await localPool.query(
            "SELECT COUNT(DISTINCT item_code) as counted FROM count_details cd JOIN counts c ON cd.count_id = c.id WHERE c.branch_id = ?",
            [branchId]
        ) as any[];
        const afterCount = afterCounted[0].counted;

        // Recalcular totalArticles para el response
        let finalTotalArticles = 0;
        try {
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM articulo') as any[];
            finalTotalArticles = totalResult[0].total;
        } catch (e) {
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM Articulos') as any[];
            finalTotalArticles = totalResult[0].total;
        }

        const beforePercentage = finalTotalArticles > 0 ? ((beforeCount / finalTotalArticles) * 100).toFixed(2) : '0';
        const afterPercentage = finalTotalArticles > 0 ? ((afterCount / finalTotalArticles) * 100).toFixed(2) : '0';

        logger.info('Seed completed successfully');
        res.json({
            message: 'Datos de prueba generados exitosamente',
            branch_id: branchId,
            counts_created: 2,
            items_added: items.length + diffItems.length,
            before: {
                counted_articles: beforeCount,
                coverage_percentage: parseFloat(beforePercentage)
            },
            after: {
                counted_articles: afterCount,
                coverage_percentage: parseFloat(afterPercentage)
            }
        });
    } catch (error: any) {
        logger.error('Error seeding test data:', error);
        res.status(500).json({ error: `Error al generar datos: ${error.message}` });
    }
});

// DELETE /api/test-data/cleanup-coverage - Limpiar datos de prueba
router.delete('/cleanup-coverage', authMiddleware, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
    logger.info('DELETE /api/test-data/cleanup-coverage requested');
    try {
        const localPool = getLocalPool();
        const connectionManager = ConnectionManager.getInstance();
        const { pool: branchPool, branchId } = getAnyAvailablePool(connectionManager, 1);

        if (!branchPool || !branchId) {
            res.status(500).json({ error: 'No se pudo conectar a ninguna sucursal.' });
            return;
        }

        // Contar registros antes de eliminar
        const [countDetailsCount] = await localPool.query(
            "SELECT COUNT(*) as count FROM count_details WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?)",
            [branchId]
        ) as any[];

        const [countsCount] = await localPool.query(
            "SELECT COUNT(*) as count FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?",
            [branchId]
        ) as any[];

        const detailsToDelete = countDetailsCount[0].count;
        const countsToDelete = countsCount[0].count;

        if (countsToDelete === 0) {
            res.status(404).json({
                error: 'No se encontraron datos de prueba para eliminar'
            });
            return;
        }

        // Eliminar detalles
        await localPool.query(
            "DELETE FROM count_details WHERE count_id IN (SELECT id FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?)",
            [branchId]
        );

        // Eliminar conteos
        await localPool.query(
            "DELETE FROM counts WHERE folio LIKE 'TEST-COVERAGE-%' AND branch_id = ?",
            [branchId]
        );

        // Obtener estadísticas después
        const [afterCounted] = await localPool.query(
            "SELECT COUNT(DISTINCT item_code) as counted FROM count_details cd JOIN counts c ON cd.count_id = c.id WHERE c.branch_id = ?",
            [branchId]
        ) as any[];
        const afterCount = afterCounted[0].counted;

        // Recalcular totalArticles
        let finalTotalArticles = 0;
        try {
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM articulo') as any[];
            finalTotalArticles = totalResult[0].total;
        } catch (e) {
            const [totalResult] = await branchPool.query('SELECT COUNT(*) as total FROM Articulos') as any[];
            finalTotalArticles = totalResult[0].total;
        }

        const afterPercentage = finalTotalArticles > 0 ? ((afterCount / finalTotalArticles) * 100).toFixed(2) : '0';

        logger.info('Cleanup completed successfully');
        res.json({
            message: 'Datos de prueba eliminados exitosamente',
            counts_deleted: countsToDelete,
            details_deleted: detailsToDelete,
            after: {
                counted_articles: afterCount,
                coverage_percentage: parseFloat(afterPercentage)
            }
        });
    } catch (error: any) {
        logger.error('Error cleaning test data:', error);
        res.status(500).json({ error: `Error al limpiar datos: ${error.message}` });
    }
});

export default router;
