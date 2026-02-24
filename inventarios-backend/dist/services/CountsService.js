"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountsService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const ConnectionManager_1 = require("../connections/ConnectionManager");
const SpecialLinesService_1 = require("./SpecialLinesService");
const WhatsAppService_1 = require("./WhatsAppService");
const server_1 = require("../websocket/server");
const NotificationService_1 = require("./NotificationService");
const AuditService_1 = require("./AuditService");
const SettingsService_1 = require("./SettingsService");
/**
 * CountsService - Servicio para gestionar conteos en la base de datos local
 */
class CountsService {
    pool = (0, database_1.getLocalPool)();
    connectionManager = ConnectionManager_1.ConnectionManager.getInstance();
    MAX_ITEMS_PER_COUNT = 10000;
    SEED_CHUNK_SIZE = 250;
    MAX_REQUESTS_PER_BATCH = 5000;
    HISTORY_CHUNK_SIZE = 500;
    async getCountedItemCodesInRange(branchId, itemCodes, from, to, almacen) {
        const counted = new Set();
        for (let i = 0; i < itemCodes.length; i += this.HISTORY_CHUNK_SIZE) {
            const chunk = itemCodes.slice(i, i + this.HISTORY_CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const almacenFilter = almacen ? 'AND c.almacen = ?' : '';
            const sql = `
        SELECT DISTINCT cd.item_code
        FROM count_details cd
        JOIN counts c ON c.id = cd.count_id
        WHERE c.branch_id = ?
          AND cd.item_code IN (${placeholders})
          AND cd.counted_at IS NOT NULL
          AND cd.counted_at >= ?
          AND cd.counted_at < ?
          ${almacenFilter}
      `;
            const params = almacen ? [branchId, ...chunk, from, to, almacen] : [branchId, ...chunk, from, to];
            const [rows] = await this.pool.execute(sql, params);
            for (const r of rows) {
                if (r?.item_code)
                    counted.add(String(r.item_code));
            }
        }
        return counted;
    }
    async getItemsHistory(branchId, itemCodes, from, to, almacen) {
        const normalized = this.normalizeItemCodes(itemCodes);
        if (normalized.length === 0)
            return [];
        const results = [];
        for (let i = 0; i < normalized.length; i += this.HISTORY_CHUNK_SIZE) {
            const chunk = normalized.slice(i, i + this.HISTORY_CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const almacenFilter = almacen ? 'AND c.almacen = ?' : '';
            const sql = `
        SELECT
          m.item_code,
          m.last_counted_at,
          MIN(c.id) as count_id,
          MIN(c.folio) as folio,
          MIN(c.almacen) as almacen
        FROM (
          SELECT cd.item_code, MAX(cd.counted_at) as last_counted_at
          FROM count_details cd
          JOIN counts c ON c.id = cd.count_id
          WHERE c.branch_id = ?
            AND cd.item_code IN (${placeholders})
            AND cd.counted_at IS NOT NULL
            AND cd.counted_at >= ?
            AND cd.counted_at < ?
            ${almacenFilter}
          GROUP BY cd.item_code
        ) m
        JOIN count_details cd ON cd.item_code = m.item_code AND cd.counted_at = m.last_counted_at
        JOIN counts c ON c.id = cd.count_id
        ${almacenFilter ? `WHERE c.almacen = ?` : ''}
        GROUP BY m.item_code, m.last_counted_at
      `;
            const params = almacen ? [branchId, ...chunk, from, to, almacen, almacen] : [branchId, ...chunk, from, to];
            const [rows] = await this.pool.execute(sql, params);
            for (const r of rows) {
                if (!r?.item_code || !r?.last_counted_at)
                    continue;
                results.push({
                    item_code: String(r.item_code),
                    last_counted_at: new Date(r.last_counted_at).toISOString(),
                    count_id: Number(r.count_id),
                    folio: String(r.folio ?? ''),
                    almacen: Number(r.almacen ?? 1)
                });
            }
        }
        return results;
    }
    /**
     * Genera múltiples folios únicos secuenciales basados en la configuración
     */
    async generateMultipleFolios(count) {
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        // Obtener formato de folio de la configuración
        const format = await SettingsService_1.settingsService.getSettingValue('folio_format', 'CNT-{YEAR}{MONTH}-{NUMBER}');
        // Extraer prefijo antes del {NUMBER} para buscar el último
        const prefixMatch = format.match(/^(.*)\{NUMBER\}/);
        let searchPattern = 'CNT-%';
        let prefix = 'CNT-';
        if (prefixMatch) {
            prefix = prefixMatch[1]
                .replace('{YEAR}', year)
                .replace('{MONTH}', month)
                .replace('{DAY}', day);
            searchPattern = `${prefix}%`;
        }
        // Obtener el último número de folio
        const [rows] = await this.pool.execute(`SELECT folio FROM counts
       WHERE folio LIKE ?
       ORDER BY id DESC LIMIT 1`, [searchPattern]);
        let number = 1;
        if (rows.length > 0) {
            const lastFolio = rows[0].folio;
            // Intentar extraer el número del final
            const numberMatch = lastFolio.substring(prefix.length).match(/^(\d+)/);
            if (numberMatch) {
                number = parseInt(numberMatch[1]) + 1;
            }
        }
        const folios = [];
        for (let i = 0; i < count; i++) {
            const numStr = String(number + i).padStart(4, '0');
            const folio = format
                .replace('{YEAR}', year)
                .replace('{MONTH}', month)
                .replace('{DAY}', day)
                .replace('{NUMBER}', numStr);
            folios.push(folio);
        }
        return folios;
    }
    /**
     * Genera folios únicos para solicitudes (requests)
     */
    async generateRequestFolios(amount) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const [rows] = await this.pool.execute(`SELECT folio FROM requests
       WHERE folio LIKE ?
       ORDER BY id DESC LIMIT 1`, [`REQ-${year}${month}-%`]);
        let number = 1;
        if (rows.length > 0) {
            const lastFolio = rows[0].folio;
            const match = lastFolio.match(/-(\d+)$/);
            if (match) {
                number = parseInt(match[1]) + 1;
            }
        }
        const folios = [];
        for (let i = 0; i < amount; i++) {
            folios.push(`REQ-${year}${month}-${String(number + i).padStart(4, '0')}`);
        }
        return folios;
    }
    /**
     * Crea solicitudes de ajuste a partir de un conteo cerrado
     */
    async createRequestsFromCount(countId, requestedByUserId) {
        const count = await this.getCountById(countId);
        if (!count) {
            throw new Error('Count not found');
        }
        if (count.status !== 'cerrado' && count.status !== 'contado') {
            throw new Error('Count must be closed');
        }
        const [diffRows] = await this.pool.execute(`
      SELECT
        cd.id as count_detail_id,
        cd.item_code,
        cd.system_stock,
        cd.counted_stock,
        (cd.counted_stock - cd.system_stock) as difference
      FROM count_details cd
      WHERE cd.count_id = ?
        AND cd.counted_stock IS NOT NULL
        AND cd.counted_stock != cd.system_stock
      ORDER BY cd.item_code ASC
      `, [countId]);
        const differences = diffRows;
        if (differences.length === 0) {
            return { created: 0, skipped: 0, total_differences: 0 };
        }
        if (differences.length > this.MAX_REQUESTS_PER_BATCH) {
            throw new Error(`Too many differences (${differences.length}).`);
        }
        // Evitar duplicados: si ya existe request para ese detail, lo saltamos
        const [existingRows] = await this.pool.execute(`SELECT count_detail_id FROM requests WHERE count_id = ?`, [countId]);
        const existingSet = new Set(existingRows.map((r) => Number(r.count_detail_id)));
        const toCreate = differences.filter((d) => !existingSet.has(d.count_detail_id));
        if (toCreate.length === 0) {
            return { created: 0, skipped: differences.length, total_differences: differences.length };
        }
        const folios = await this.generateRequestFolios(toCreate.length);
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const valuesSql = toCreate.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
            const sql = `
        INSERT INTO requests (
          folio, count_id, count_detail_id, branch_id, item_code,
          system_stock, counted_stock, difference, status, requested_by_user_id
        ) VALUES ${valuesSql}
      `;
            const params = [];
            toCreate.forEach((d, idx) => {
                params.push(folios[idx], countId, d.count_detail_id, count.branch_id, d.item_code, d.system_stock, d.counted_stock, d.difference, 'pendiente', requestedByUserId);
            });
            await conn.execute(sql, params);
            await conn.commit();
        }
        catch (err) {
            try {
                await conn.rollback();
            }
            catch {
                // ignore rollback error
            }
            throw err;
        }
        finally {
            conn.release();
        }
        // Notificar creación de solicitudes
        try {
            const [branchRows] = await this.pool.execute('SELECT name FROM branches WHERE id = ?', [count.branch_id]);
            const [userRows] = await this.pool.execute('SELECT name FROM users WHERE id = ?', [requestedByUserId]);
            const branchName = branchRows[0]?.name || `Sucursal ${count.branch_id}`;
            const userName = userRows[0]?.name || 'Usuario';
            for (const req of toCreate) {
                await NotificationService_1.notificationService.notifyRequestCreated(count.folio, branchName, count.branch_id, req.item_code, req.difference, userName, 'count');
                // Find the folio for this request from the folios array generated earlier
                const reqIdx = toCreate.indexOf(req);
                const reqFolio = folios[reqIdx];
                // Emit realization event
                (0, server_1.emitRequestCreated)({
                    folio: reqFolio,
                    count_id: countId,
                    item_code: req.item_code,
                    branch_id: count.branch_id,
                    difference: req.difference
                });
            }
        }
        catch (err) {
            logger_1.logger.error('Error notifying requests from count:', err);
        }
        // Log the request creation
        if (toCreate.length > 0) {
            await AuditService_1.auditService.log({
                user_id: requestedByUserId,
                action: 'CREATE_REQUESTS_BATCH',
                entity_type: 'count',
                entity_id: countId,
                new_values: {
                    count: toCreate.length,
                    folios: folios,
                    items: toCreate.map(d => d.item_code)
                }
            });
        }
        return {
            created: toCreate.length,
            skipped: differences.length - toCreate.length,
            total_differences: differences.length
        };
    }
    /**
     * Valida que no existan conteos activos con los mismos códigos de artículo
     */
    async validateNoDuplicateActiveCounts(branchId, almacen, itemCodes) {
        if (itemCodes.length === 0)
            return;
        const CHUNK_SIZE = 500;
        const duplicates = [];
        for (let i = 0; i < itemCodes.length; i += CHUNK_SIZE) {
            const chunk = itemCodes.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const sql = `
        SELECT DISTINCT
          cd.item_code,
          c.folio,
          c.status
        FROM count_details cd
        JOIN counts c ON c.id = cd.count_id
        WHERE c.branch_id = ?
          AND c.almacen = ?
          AND c.status IN ('pendiente', 'en_proceso', 'contado')
          AND cd.item_code IN (${placeholders})
        ORDER BY cd.item_code, c.id DESC
      `;
            const params = [branchId, almacen, ...chunk];
            const [rows] = await this.pool.execute(sql, params);
            for (const row of rows) {
                duplicates.push({
                    item_code: String(row.item_code),
                    folio: String(row.folio),
                    status: String(row.status)
                });
            }
        }
        if (duplicates.length > 0) {
            const duplicatesList = duplicates
                .map(d => `• ${d.item_code} (Folio: ${d.folio}, Estado: ${d.status})`)
                .join('\n');
            throw new Error(`No se pueden crear conteos.\n\nLos siguientes artículos ya tienen conteos activos:\n\n${duplicatesList}\n\nPor favor, cierra o cancela los conteos existentes antes de crear nuevos.`);
        }
    }
    /**
     * Crea múltiples conteos - uno por cada artículo en el almacén seleccionado
     */
    async createCount(userId, data) {
        let itemsToCount = [];
        let itemsDataMap = new Map();
        if (data.classification === 'ajuste' && data.items_data?.length) {
            // Direct adjustment flow
            itemsToCount = data.items_data.map(i => i.item_code);
            data.items_data.forEach(i => itemsDataMap.set(i.item_code, i.count));
        }
        else {
            // Standard flow
            itemsToCount = this.normalizeItemCodes(data.items);
        }
        if (itemsToCount.length === 0) {
            throw new Error('No items specified for count');
        }
        if (itemsToCount.length > this.MAX_ITEMS_PER_COUNT) {
            throw new Error(`Too many items (${itemsToCount.length}). Max allowed is ${this.MAX_ITEMS_PER_COUNT}.`);
        }
        const selectedWarehouse = data.almacen || 1;
        // Step 1: Query which items exist in the catalog (articulo table)
        const itemsInCatalog = [];
        for (let i = 0; i < itemsToCount.length; i += this.SEED_CHUNK_SIZE) {
            const chunk = itemsToCount.slice(i, i + this.SEED_CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const query = `
        SELECT DISTINCT Clave_Articulo as item_code
        FROM articulo
        WHERE Clave_Articulo IN (${placeholders})
      `;
            try {
                const results = await this.connectionManager.executeQuery(data.branch_id, query, chunk);
                for (const row of results) {
                    itemsInCatalog.push(String(row.item_code));
                }
            }
            catch (err) {
                if (err?.code === 'ER_NO_SUCH_TABLE') {
                    throw new Error(`Branch ${data.branch_id} missing required table articulo`);
                }
                throw err;
            }
        }
        if (itemsInCatalog.length === 0) {
            throw new Error(`No valid items found in catalog for the requested codes`);
        }
        // Use items found in catalog
        const itemsInWarehouse = itemsInCatalog;
        // Validate no duplicate active counts exist for these items
        await this.validateNoDuplicateActiveCounts(data.branch_id, selectedWarehouse, itemsInWarehouse);
        // Step 2: Filter out already counted items if requested
        const finalItemsToCount = [];
        for (const item of itemsInWarehouse) {
            if (data.exclude_already_counted_month && data.month_from && data.month_to) {
                const counted = await this.getCountedItemCodesInRange(data.branch_id, [item], data.month_from, data.month_to, selectedWarehouse);
                if (counted.has(item)) {
                    continue; // Skip this item
                }
            }
            finalItemsToCount.push(item);
        }
        if (finalItemsToCount.length === 0) {
            logger_1.logger.info(`All ${itemsInWarehouse.length} items were excluded as they were already counted. No counts created.`);
            return [];
        }
        // Step 3: Generate all folios at once
        const folios = await this.generateMultipleFolios(finalItemsToCount.length);
        const createdCountIds = [];
        const createdCounts = [];
        const conn = await this.pool.getConnection();
        // Determine status: if direct adjustment, set to 'cerrado'
        const isDirectAdjustment = data.classification === 'ajuste' && itemsDataMap.size > 0;
        const initialStatus = isDirectAdjustment ? 'cerrado' : 'pendiente';
        const now = new Date();
        try {
            await conn.beginTransaction();
            for (let i = 0; i < finalItemsToCount.length; i++) {
                const item = finalItemsToCount[i];
                const folio = folios[i];
                const query = `
          INSERT INTO counts (
            folio, branch_id, almacen, type, classification, priority, status,
            responsible_user_id, assigned_at, created_by_user_id, scheduled_date,
            notes, tolerance_percentage, started_at, finished_at, closed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
                const params = [
                    folio,
                    data.branch_id,
                    selectedWarehouse,
                    data.type,
                    data.classification || 'inventario',
                    data.priority || 'media',
                    initialStatus,
                    data.responsible_user_id,
                    data.responsible_user_id ? now : null, // assigned_at
                    userId,
                    data.scheduled_date || null,
                    data.notes || null,
                    data.tolerance_percentage || 5.0,
                    isDirectAdjustment ? now : null,
                    isDirectAdjustment ? now : null,
                    isDirectAdjustment ? now : null
                ];
                const [result] = await conn.execute(query, params);
                const insertId = result.insertId;
                createdCountIds.push(insertId);
                if (data.classification === 'ajuste' && itemsDataMap.has(item)) {
                    // Direct adjustment: Create detail with counted stock
                    const countedStock = itemsDataMap.get(item);
                    await this.seedCountDetailsWithValues(conn, insertId, data.branch_id, item, selectedWarehouse, countedStock);
                }
                else {
                    // Standard flow: Seed details with 0 counted stock (or null)
                    await this.seedCountDetailsFromItems(conn, insertId, data.branch_id, [item], selectedWarehouse);
                }
                logger_1.logger.info(`Count created ID: ${insertId}, Folio: ${folio} for item ${item} in warehouse ${selectedWarehouse}`);
            }
            await conn.commit();
        }
        catch (err) {
            try {
                await conn.rollback();
            }
            catch {
                // ignore rollback error
            }
            throw err;
        }
        finally {
            conn.release();
        }
        // Automatically create adjustment requests for direct adjustments
        if (isDirectAdjustment) {
            for (const id of createdCountIds) {
                try {
                    await this.createRequestsFromCount(id, userId);
                }
                catch (err) {
                    logger_1.logger.error(`Error auto-creating request for count ${id}`, err);
                    // Don't throw here, count is already created and closed
                }
            }
        }
        // Step 5: Fetch created counts (outside transaction so they are visible)
        for (const id of createdCountIds) {
            const count = await this.getCountById(id);
            if (count) {
                createdCounts.push(count);
                // Emitir evento de creación
                (0, server_1.emitCountCreated)(count);
                // Notificar asignación si hay un responsable
                if (count.responsible_user_id) {
                    this.notifyAssignment(count, false);
                }
            }
        }
        logger_1.logger.info(`Successfully created and returned ${createdCounts.length} counts`);
        // Log the creation (bulk)
        if (createdCounts.length > 0) {
            await AuditService_1.auditService.log({
                user_id: userId,
                action: 'CREATE_COUNTS',
                entity_type: 'count',
                entity_id: createdCounts[0].id, // Reference the first one or we could log individual but bulk is better here
                new_values: {
                    count: createdCounts.length,
                    folios: createdCounts.map(c => c.folio),
                    branch_id: data.branch_id,
                    type: data.type
                }
            });
        }
        return createdCounts;
    }
    normalizeItemCodes(items) {
        if (!Array.isArray(items))
            return [];
        const set = new Set();
        for (const raw of items) {
            const code = (raw ?? '').toString().trim();
            if (!code)
                continue;
            set.add(code);
        }
        return Array.from(set);
    }
    async seedCountDetailsFromItems(conn, countId, branchId, itemCodes, almacen = 1) {
        const rowsToInsert = [];
        for (let i = 0; i < itemCodes.length; i += this.SEED_CHUNK_SIZE) {
            const chunk = itemCodes.slice(i, i + this.SEED_CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const articuloQuery = `
        SELECT
          Clave_Articulo as item_code,
          Descripcion as item_description,
          Unidad_Medida as unit
        FROM articulo
        WHERE Clave_Articulo IN (${placeholders})
      `;
            // Get stock for specific warehouse only
            const stockQuery = `
        SELECT
          aa.Clave_Articulo as item_code,
          aa.Almacen as warehouse_id,
          alm.Nombre as warehouse_name,
          aa.Existencia_Fisica as stock
        FROM articuloalm aa
        LEFT JOIN almacenes alm ON aa.Almacen = alm.Almacen
        WHERE aa.Clave_Articulo IN (${placeholders})
          AND aa.Almacen = ?
      `;
            let articuloRows = [];
            let stockRows = [];
            try {
                articuloRows = await this.connectionManager.executeQuery(branchId, articuloQuery, chunk);
            }
            catch (err) {
                if (err?.code === 'ER_NO_SUCH_TABLE') {
                    throw new Error(`Branch ${branchId} missing required tables articulo/articuloalm`);
                }
                throw err;
            }
            try {
                stockRows = await this.connectionManager.executeQuery(branchId, stockQuery, [...chunk, almacen]);
            }
            catch (err) {
                if (err?.code === 'ER_NO_SUCH_TABLE') {
                    throw new Error(`Branch ${branchId} missing required tables articulo/articuloalm`);
                }
                throw err;
            }
            // Fetch warehouse name once if needed
            let warehouseName = null;
            if (stockRows.length > 0) {
                warehouseName = stockRows[0].warehouse_name;
            }
            else {
                // Fallback query for warehouse name if no items have stock
                try {
                    const whResults = await this.connectionManager.executeQuery(branchId, `SELECT Nombre FROM almacenes WHERE Almacen = ?`, [almacen]);
                    if (whResults.length > 0)
                        warehouseName = whResults[0].Nombre;
                }
                catch (e) {
                    // Ignore error, name will be null
                }
            }
            const stockByCode = new Map();
            for (const s of stockRows)
                stockByCode.set(s.item_code, s);
            // Iterate through ALL valid articles, not just those with stock
            for (const info of articuloRows) {
                const stockRow = stockByCode.get(info.item_code);
                rowsToInsert.push({
                    item_code: info.item_code,
                    item_description: info.item_description ?? null,
                    unit: info.unit ?? null,
                    warehouse_id: stockRow ? stockRow.warehouse_id : almacen,
                    warehouse_name: stockRow ? stockRow.warehouse_name : warehouseName,
                    system_stock: stockRow ? Number(stockRow.stock) : 0
                });
            }
        }
        if (rowsToInsert.length === 0)
            return;
        for (let i = 0; i < rowsToInsert.length; i += this.SEED_CHUNK_SIZE) {
            const chunk = rowsToInsert.slice(i, i + this.SEED_CHUNK_SIZE);
            const valuesSql = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
            const insertSql = `
        INSERT INTO count_details (
          count_id, item_code, item_description, warehouse_id, warehouse_name,
          system_stock, counted_stock, unit
        ) VALUES ${valuesSql}
      `;
            const params = [];
            for (const row of chunk) {
                params.push(countId, row.item_code, row.item_description, row.warehouse_id, row.warehouse_name, row.system_stock, null, row.unit);
            }
            await conn.execute(insertSql, params);
        }
        logger_1.logger.info(`Seeded ${rowsToInsert.length} count_details for count ${countId} (warehouse ${almacen})`);
    }
    async seedCountDetailsWithValues(conn, countId, branchId, itemCode, almacen, countedStock) {
        // 1. Get Item Info
        const articuloQuery = `
      SELECT
        Clave_Articulo as item_code,
        Descripcion as item_description,
        Unidad_Medida as unit
      FROM articulo
      WHERE Clave_Articulo = ?
    `;
        // 2. Get System Stock
        const stockQuery = `
      SELECT
        aa.Clave_Articulo as item_code,
        aa.Almacen as warehouse_id,
        alm.Nombre as warehouse_name,
        aa.Existencia_Fisica as stock
      FROM articuloalm aa
      LEFT JOIN almacenes alm ON aa.Almacen = alm.Almacen
      WHERE aa.Clave_Articulo = ?
        AND aa.Almacen = ?
    `;
        let articuloRow = null;
        let stockRow = null;
        try {
            const artResults = await this.connectionManager.executeQuery(branchId, articuloQuery, [itemCode]);
            if (artResults.length > 0)
                articuloRow = artResults[0];
        }
        catch (err) {
            // Log error but proceed if possible
            logger_1.logger.error(`Error fetching article info for ${itemCode}`, err);
        }
        try {
            const stockResults = await this.connectionManager.executeQuery(branchId, stockQuery, [itemCode, almacen]);
            if (stockResults.length > 0)
                stockRow = stockResults[0];
        }
        catch (err) {
            logger_1.logger.error(`Error fetching stock info for ${itemCode}`, err);
        }
        // 3. Robust Warehouse Name Fallback (in case item has no stock row yet)
        let warehouseName = stockRow?.warehouse_name || null;
        if (!warehouseName) {
            try {
                const whResults = await this.connectionManager.executeQuery(branchId, `SELECT Nombre FROM almacenes WHERE Almacen = ?`, [almacen]);
                if (whResults.length > 0)
                    warehouseName = whResults[0].Nombre;
            }
            catch (e) {
                logger_1.logger.error(`Error fetching warehouse name for ID ${almacen}`, e);
            }
        }
        if (!warehouseName)
            warehouseName = 'Almacén ' + almacen;
        if (!articuloRow) {
            logger_1.logger.warn(`Item ${itemCode} not found in catalog, skipping detail creation`);
            return;
        }
        const systemStock = stockRow ? Number(stockRow.stock) : 0;
        // Calculate difference
        const difference = countedStock - systemStock;
        const differencePercentage = systemStock !== 0 ? ((difference / systemStock) * 100) : (countedStock > 0 ? 100 : 0);
        const insertSql = `
      INSERT INTO count_details (
        count_id, item_code, item_description, warehouse_id, warehouse_name,
        system_stock, counted_stock, difference, difference_percentage, unit,
        counted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
        await conn.execute(insertSql, [
            countId,
            itemCode,
            articuloRow.item_description,
            almacen,
            warehouseName,
            systemStock,
            countedStock,
            difference,
            differencePercentage,
            articuloRow.unit
        ]);
        logger_1.logger.info(`Seeded detail for adjustment ${itemCode}: system=${systemStock}, counted=${countedStock}`);
    }
    /**
     * Obtiene un conteo por ID
     */
    async getCountById(id) {
        const [rows] = await this.pool.execute(`SELECT 
        c.*,
        u.name as responsible_user_name
      FROM counts c
      LEFT JOIN users u ON c.responsible_user_id = u.id
      WHERE c.id = ?`, [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Obtiene un conteo por folio
     */
    async getCountByFolio(folio) {
        const [rows] = await this.pool.execute('SELECT * FROM counts WHERE folio = ?', [folio]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Lista conteos con filtros
     */
    async listCounts(filters) {
        let query = `
      SELECT 
        c.*,
        u.name as responsible_user_name,
        GROUP_CONCAT(DISTINCT cd.item_code ORDER BY cd.item_code SEPARATOR ', ') as item_codes,
        MAX(cd.warehouse_name) as almacen_nombre
      FROM counts c
      LEFT JOIN users u ON c.responsible_user_id = u.id
      LEFT JOIN count_details cd ON cd.count_id = c.id
      WHERE 1=1
    `;
        let countQuery = 'SELECT COUNT(*) as total FROM counts c WHERE 1=1';
        const params = [];
        if (filters.branch_id) {
            query += ' AND c.branch_id = ?';
            countQuery += ' AND c.branch_id = ?';
            params.push(filters.branch_id);
        }
        const statusFilters = Array.isArray(filters.statuses) && filters.statuses.length
            ? filters.statuses
            : filters.status
                ? [filters.status]
                : [];
        if (statusFilters.length) {
            const placeholders = statusFilters.map(() => '?').join(', ');
            query += ` AND c.status IN (${placeholders})`;
            countQuery += ` AND c.status IN (${placeholders})`;
            params.push(...statusFilters);
        }
        if (filters.type) {
            query += ' AND c.type = ?';
            countQuery += ' AND c.type = ?';
            params.push(filters.type);
        }
        if (filters.classification) {
            query += ' AND c.classification = ?';
            countQuery += ' AND c.classification = ?';
            params.push(filters.classification);
        }
        if (filters.responsible_user_id) {
            query += ' AND c.responsible_user_id = ?';
            countQuery += ' AND c.responsible_user_id = ?';
            params.push(filters.responsible_user_id);
        }
        if (filters.date_from) {
            query += ' AND c.created_at >= ?';
            countQuery += ' AND c.created_at >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            query += ' AND c.created_at <= ?';
            countQuery += ' AND c.created_at <= ?';
            params.push(filters.date_to);
        }
        if (filters.scheduled_from) {
            query += ' AND c.scheduled_date >= ?';
            countQuery += ' AND c.scheduled_date >= ?';
            params.push(filters.scheduled_from);
        }
        if (filters.scheduled_to) {
            query += ' AND c.scheduled_date <= ?';
            countQuery += ' AND c.scheduled_date <= ?';
            params.push(filters.scheduled_to);
        }
        if (filters.search) {
            const search = `%${filters.search}%`;
            const searchSql = ` AND (
        c.folio LIKE ? 
        OR u.name LIKE ? 
        OR c.classification LIKE ? 
        OR c.status LIKE ?
        OR EXISTS (
          SELECT 1 FROM count_details cd2 
          WHERE cd2.count_id = c.id AND cd2.item_code LIKE ?
        )
      )`;
            query += searchSql;
            countQuery += searchSql;
            params.push(search, search, search, search, search);
        }
        query += ' GROUP BY c.id';
        query += ' ORDER BY c.folio DESC';
        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
            if (filters.offset) {
                query += ' OFFSET ?';
                params.push(filters.offset);
            }
        }
        const [counts] = await this.pool.execute(query, params);
        const [countResult] = await this.pool.execute(countQuery, params);
        // Get active special lines for detection
        const [specialLinesRows] = await this.pool.execute('SELECT line_code FROM special_lines WHERE is_active = 1');
        const activeSpecialLineCodes = new Set(specialLinesRows.map((row) => String(row.line_code)));
        // Add has_special_lines field to each count
        const countsWithSpecialLines = counts.map((count) => {
            let hasSpecialLines = false;
            if (activeSpecialLineCodes.size > 0) {
                // Check item_codes from GROUP_CONCAT
                const itemCodes = count.item_codes ? String(count.item_codes).split(', ') : [];
                for (const itemCode of itemCodes) {
                    if (itemCode && itemCode.length >= 5) {
                        const lineCode = itemCode.substring(0, 5);
                        if (activeSpecialLineCodes.has(lineCode)) {
                            hasSpecialLines = true;
                            break;
                        }
                    }
                }
            }
            return {
                ...count,
                has_special_lines: hasSpecialLines
            };
        });
        return {
            counts: countsWithSpecialLines,
            total: countResult[0].total
        };
    }
    /**
     * Refresca el stock de sistema desde el ERP para todos los artículos en un conteo
     */
    async refreshStocksForCount(conn, countId, branchId, almacen) {
        try {
            // 1. Obtener todos los item_code del conteo
            const [details] = await conn.execute('SELECT item_code FROM count_details WHERE count_id = ?', [countId]);
            if (details.length === 0)
                return;
            const itemCodes = details.map(d => d.item_code);
            // 2. Consultar stock en el ERP en chunks
            for (let i = 0; i < itemCodes.length; i += this.SEED_CHUNK_SIZE) {
                const chunk = itemCodes.slice(i, i + this.SEED_CHUNK_SIZE);
                const placeholders = chunk.map(() => '?').join(',');
                const stockQuery = `
          SELECT
            aa.Clave_Articulo as item_code,
            aa.Existencia_Fisica as stock
          FROM articuloalm aa
          WHERE aa.Clave_Articulo IN (${placeholders})
            AND aa.Almacen = ?
        `;
                const stockRows = await this.connectionManager.executeQuery(branchId, stockQuery, [...chunk, almacen]);
                const stockByCode = new Map();
                for (const s of stockRows)
                    stockByCode.set(s.item_code, Number(s.stock));
                // 3. Actualizar count_details con los nuevos valores de system_stock
                for (const itemCode of chunk) {
                    const stock = stockByCode.get(itemCode) || 0;
                    await conn.execute('UPDATE count_details SET system_stock = ? WHERE count_id = ? AND item_code = ?', [stock, countId, itemCode]);
                }
            }
            logger_1.logger.info(`Refreshed system stock for ${itemCodes.length} items in count ${countId} (Branch: ${branchId}, Almacen: ${almacen})`);
        }
        catch (err) {
            logger_1.logger.error(`Error refreshing stock for count ${countId}:`, err);
            // No lanzamos error para permitir que el conteo inicie aún si falla el refresco de stock del ERP
            // Simplemente retornamos un indicador para que el llamante sepa que no se pudo sincronizar
            throw err; // Lo lanzamos pero lo atraparemos en el updateCount para manejarlo suavemente
        }
    }
    /**
     * Actualiza un conteo
     */
    async updateCount(id, data, userId) {
        const existing = await this.getCountById(id);
        if (!existing) {
            throw new Error('Count not found');
        }
        const updates = [];
        const params = [];
        if (data.status !== undefined) {
            // Evitar que un conteo ya iniciado/cerrado pueda ser iniciado nuevamente
            if (data.status === 'contando' && existing.status !== 'pendiente') {
                throw new Error('Count already started');
            }
            updates.push('status = ?');
            params.push(data.status);
            // Emitir evento de cambio de estado
            (0, server_1.emitCountStatusChanged)(id, existing.folio, existing.status, data.status);
            // Auto-establecer timestamps según el estado
            if (data.status === 'contando' && !data.started_at) {
                updates.push('started_at = NOW()');
            }
            else if (data.status === 'contado' && !data.finished_at) {
                updates.push('finished_at = NOW()');
            }
            else if (data.status === 'cerrado' && !data.closed_at) {
                updates.push('closed_at = NOW()');
            }
        }
        if (data.notes !== undefined) {
            updates.push('notes = ?');
            params.push(data.notes);
        }
        if (data.started_at) {
            updates.push('started_at = ?');
            params.push(data.started_at);
        }
        if (data.finished_at) {
            updates.push('finished_at = ?');
            params.push(data.finished_at);
        }
        if (data.closed_at) {
            updates.push('closed_at = ?');
            params.push(data.closed_at);
        }
        if (data.responsible_user_id !== undefined && data.responsible_user_id !== existing.responsible_user_id) {
            updates.push('responsible_user_id = ?');
            params.push(data.responsible_user_id);
            // Actualizar timestamps de asignación
            if (!existing.assigned_at && data.responsible_user_id) {
                updates.push('assigned_at = NOW()');
            }
            else if (data.responsible_user_id) {
                updates.push('last_reassigned_at = NOW()');
            }
            // Emitir evento de reasignación
            (0, server_1.emitCountReassigned)(id, existing.folio, existing.responsible_user_id, data.responsible_user_id);
            // Notificar al nuevo responsable
            const updatedCount = await this.getCountById(id);
            if (updatedCount) {
                this.notifyAssignment(updatedCount, true);
            }
        }
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            if (data.status === 'contando' && existing.status === 'pendiente') {
                // Refrescar stock antes de marcar como contando
                try {
                    await this.refreshStocksForCount(conn, id, existing.branch_id, existing.almacen);
                }
                catch (refreshErr) {
                    logger_1.logger.warn(`Could not refresh stock for count ${id} due to connection failure, but continuing...`);
                    // Agregamos una nota automática indicando el fallo de sincronización
                    const syncErrorNote = `\n[SISTEMA] No se pudo sincronizar el stock con el ERP el ${new Date().toLocaleString('es-MX')}. Se usará el último stock registrado.`;
                    if (data.notes !== undefined) {
                        data.notes += syncErrorNote;
                        // Actualizar params para el update posterior si notas están en el set
                    }
                    else {
                        // Si no hay notas nuevas, tenemos que agregarlas al set de updates
                        updates.push('notes = CONCAT(IFNULL(notes, ""), ?)');
                        params.push(syncErrorNote);
                    }
                }
            }
            if (updates.length > 0) {
                // El ID debe ser el último parámetro
                const query = `UPDATE counts SET ${updates.join(', ')} WHERE id = ?`;
                await conn.execute(query, [...params, id]);
            }
            await conn.commit();
        }
        catch (err) {
            await conn.rollback();
            logger_1.logger.error(`Error updating count ${id}:`, err);
            throw err;
        }
        finally {
            conn.release();
        }
        const count = await this.getCountById(id);
        if (!count) {
            throw new Error('Count not found after update');
        }
        // Log the update
        await AuditService_1.auditService.log({
            user_id: userId,
            action: 'UPDATE_COUNT',
            entity_type: 'count',
            entity_id: id,
            old_values: existing,
            new_values: data
        });
        let specialLineAlerts = null;
        // Si se está cerrando el conteo, verificar líneas especiales
        if ((data.status === 'contado' || data.status === 'cerrado') && existing.status !== data.status) {
            try {
                const [branchRows] = await this.pool.execute('SELECT name FROM branches WHERE id = ?', [count.branch_id]);
                const branchName = branchRows[0]?.name || `Sucursal ${count.branch_id}`;
                // Notificar finalización de conteo
                await NotificationService_1.notificationService.notifyCountFinished(count.folio, branchName, count.branch_id, count.responsible_user_name || 'Un surtidor');
                // Si es cierre final, verificar líneas especiales (Mantiene lógica anterior)
                if (data.status === 'cerrado') {
                    specialLineAlerts = await this.checkSpecialLinesAndNotify(count);
                }
            }
            catch (err) {
                logger_1.logger.error(`Error notifying count finish for ${id}:`, err);
            }
        }
        logger_1.logger.info(`Count ${id} updated`);
        return { ...count, specialLineAlerts };
    }
    /**
     * Helper para notificar asignación/reasignación
     */
    async notifyAssignment(count, isReassignment) {
        try {
            // Obtener info del usuario y sucursal
            const [userRows] = await this.pool.execute('SELECT name, phone_number FROM users WHERE id = ?', [count.responsible_user_id]);
            const [branchRows] = await this.pool.execute('SELECT name FROM branches WHERE id = ?', [count.branch_id]);
            if (userRows.length === 0 || branchRows.length === 0)
                return;
            const user = userRows[0];
            const branch = branchRows[0];
            // Contar artículos 
            const [itemRows] = await this.pool.execute('SELECT COUNT(*) as total FROM count_details WHERE count_id = ?', [count.id]);
            const itemsCount = itemRows[0]?.total || 1;
            if (isReassignment) {
                await NotificationService_1.notificationService.sendReassignmentNotification(user.name, user.phone_number, count.folio, branch.name, itemsCount);
            }
            else {
                await NotificationService_1.notificationService.sendAssignmentNotification(user.name, user.phone_number, count.folio, branch.name, itemsCount);
            }
        }
        catch (err) {
            logger_1.logger.error(`Error notifying assignment for count ${count.id}:`, err);
        }
    }
    /**
     * Verifica si hay artículos de líneas especiales con diferencias significativas
     * y envía notificaciones por WhatsApp
     */
    async checkSpecialLinesAndNotify(count) {
        // Obtener detalles del conteo con diferencias
        const [detailsRows] = await this.pool.execute(`
      SELECT
        cd.item_code,
        cd.item_description,
        cd.system_stock,
        cd.counted_stock,
        cd.difference,
        cd.difference_percentage
      FROM count_details cd
      WHERE cd.count_id = ?
        AND cd.counted_stock IS NOT NULL
        AND cd.counted_stock != cd.system_stock
      ORDER BY ABS(cd.difference) DESC
      `, [count.id]);
        if (detailsRows.length === 0) {
            logger_1.logger.info(`Count ${count.id} has no differences, skipping special lines check`);
            return { processed: false, reason: 'no_differences' };
        }
        // Agrupar artículos por línea especial
        const specialLineAlerts = new Map();
        for (const row of detailsRows) {
            const itemCode = String(row.item_code);
            // Verificar si pertenece a una línea especial
            const specialLine = await SpecialLinesService_1.specialLinesService.checkItemBelongsToSpecialLine(itemCode);
            if (!specialLine)
                continue;
            const diffPercentage = Math.abs(Number(row.difference_percentage || 0));
            // Verificar si excede la tolerancia
            if (diffPercentage > specialLine.tolerance_percentage) {
                const lineCode = specialLine.line_code;
                if (!specialLineAlerts.has(lineCode)) {
                    specialLineAlerts.set(lineCode, {
                        line: specialLine,
                        items: []
                    });
                }
                specialLineAlerts.get(lineCode).items.push({
                    itemCode: itemCode,
                    description: String(row.item_description || itemCode),
                    expected: Number(row.system_stock),
                    counted: Number(row.counted_stock),
                    difference: Number(row.difference),
                    differencePercentage: Number(row.difference_percentage || 0)
                });
            }
        }
        const results = [];
        // Enviar notificaciones para cada línea especial afectada
        for (const [lineCode, alert] of specialLineAlerts) {
            const whatsappNumbers = SpecialLinesService_1.specialLinesService.getWhatsAppNumbers(alert.line);
            if (whatsappNumbers.length === 0) {
                logger_1.logger.warn(`Special line ${lineCode} has no WhatsApp numbers configured`);
                results.push({ lineCode, status: 'skipped', reason: 'no_whatsapp_numbers' });
                continue;
            }
            // Obtener nombre de sucursal
            let branchName = `Sucursal ${count.branch_id}`;
            try {
                const [branchRows] = await this.pool.execute('SELECT name FROM branches WHERE id = ?', [count.branch_id]);
                if (branchRows.length > 0) {
                    branchName = String(branchRows[0].name);
                }
            }
            catch (err) {
                logger_1.logger.error('Error fetching branch name:', err);
            }
            const alertData = {
                folio: count.folio,
                branchName: branchName,
                lineCode: lineCode,
                lineName: alert.line.line_name || lineCode,
                itemsWithDifferences: alert.items
            };
            try {
                const result = await WhatsAppService_1.whatsappService.sendCountAlert(whatsappNumbers, alertData);
                logger_1.logger.info(`WhatsApp alerts sent for special line ${lineCode} in count ${count.folio}: ` +
                    `${result.sent} sent, ${result.failed} failed`);
                // Include full result with details for debugging
                results.push({ lineCode, status: 'sent', result });
            }
            catch (err) {
                logger_1.logger.error(`Error sending WhatsApp alert for line ${lineCode}:`, err);
                results.push({ lineCode, status: 'error', error: err });
            }
        }
        if (specialLineAlerts.size > 0) {
            logger_1.logger.info(`Processed ${specialLineAlerts.size} special line(s) with significant differences in count ${count.folio}`);
        }
        return {
            processed: true,
            linesDetected: specialLineAlerts.size,
            details: results
        };
    }
    /**
     * Agrega un detalle al conteo
     */
    async addCountDetail(countId, userId, data) {
        const query = `
      INSERT INTO count_details (
        count_id, item_code, item_description, warehouse_id, warehouse_name,
        system_stock, counted_stock, unit, counted_by_user_id, counted_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
        const [result] = await this.pool.execute(query, [
            countId,
            data.item_code,
            data.item_description || null,
            data.warehouse_id,
            data.warehouse_name || null,
            data.system_stock,
            data.counted_stock,
            data.unit || null,
            userId,
            data.notes || null
        ]);
        const detail = await this.getCountDetailById(result.insertId);
        if (!detail) {
            throw new Error('Failed to create count detail');
        }
        logger_1.logger.info(`Count detail created for count ${countId}, item ${data.item_code}, warehouse ${data.warehouse_id}`);
        // Emitir detalle agregado
        (0, server_1.emitCountDetailAdded)(countId, detail);
        return detail;
    }
    /**
     * Obtiene un detalle por ID
     */
    async getCountDetailById(id) {
        const [rows] = await this.pool.execute('SELECT * FROM count_details WHERE id = ?', [id]);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    }
    /**
     * Obtiene todos los detalles de un conteo
     */
    async getCountDetails(countId) {
        const [rows] = await this.pool.execute('SELECT * FROM count_details WHERE count_id = ? ORDER BY item_code', [countId]);
        return rows;
    }
    /**
     * Actualiza un detalle de conteo
     */
    async updateCountDetail(id, data, userId) {
        const existing = await this.getCountDetailById(id);
        if (!existing) {
            throw new Error('Count detail not found');
        }
        const difference = data.counted_stock - existing.system_stock;
        const differencePercentage = existing.system_stock !== 0
            ? (difference / existing.system_stock) * 100
            : difference !== 0
                ? 100
                : 0;
        const query = `
      UPDATE count_details
      SET counted_stock = ?, difference = ?, difference_percentage = ?, notes = ?, counted_at = NOW()
      WHERE id = ?
    `;
        await this.pool.execute(query, [
            data.counted_stock,
            difference,
            differencePercentage,
            data.notes || null,
            id
        ]);
        // Si ya no hay detalles pendientes, cerrar el conteo automáticamente
        try {
            const countId = existing.count_id;
            if (countId) {
                const [pendingRows] = await this.pool.execute(`SELECT COUNT(*) as pending
           FROM count_details
           WHERE count_id = ? AND counted_at IS NULL`, [countId]);
                const pending = Number(pendingRows?.[0]?.pending ?? 0);
                if (pending === 0) {
                    // Usar updateCount para asegurar que se ejecuten los side effects (notificaciones)
                    const updatedCount = await this.updateCount(countId, { status: 'cerrado' }, userId);
                    // Si hay alertas, guardarlas temporalmente para retornarlas
                    if (updatedCount.specialLineAlerts) {
                        this._tempAlerts = updatedCount.specialLineAlerts;
                    }
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('Auto-close count failed:', err);
        }
        const detail = await this.getCountDetailById(id);
        if (!detail) {
            throw new Error('Count detail not found after update');
        }
        logger_1.logger.info(`Count detail ${id} updated`);
        // Attach alerts if they were captured during auto-close
        const alertData = this._tempAlerts;
        if (alertData) {
            delete this._tempAlerts;
            return { ...detail, specialLineAlerts: alertData };
        }
        return detail;
    }
    /**
     * Obtiene estadísticas del dashboard
     * Devuelve contadores globales, resumen por sucursal y conteos recientes
     */
    async getDashboardStats() {
        // 1. Contadores globales
        const [globalRows] = await this.pool.execute(`
      SELECT
        COUNT(*) as total_counts,
        SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END) as pending_counts,
        SUM(CASE WHEN status = 'contando' THEN 1 ELSE 0 END) as in_progress_counts,
        SUM(CASE WHEN status = 'contado' THEN 1 ELSE 0 END) as finished_counts,
        SUM(CASE WHEN status = 'cerrado' THEN 1 ELSE 0 END) as closed_counts,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelled_counts,
        SUM(CASE WHEN status = 'pendiente' AND DATE(scheduled_date) = CURDATE() THEN 1 ELSE 0 END) as scheduled_today
      FROM counts
    `);
        const global = globalRows[0] || {};
        // 2. Resumen por sucursal
        const [branchRows] = await this.pool.execute(`
      SELECT
        b.id as branch_id,
        b.name as branch_name,
        COUNT(c.id) as total,
        SUM(CASE WHEN c.status = 'pendiente' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN c.status = 'contando' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN c.status = 'contado' THEN 1 ELSE 0 END) as finished,
        SUM(CASE WHEN c.status = 'cerrado' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN c.status = 'cancelado' THEN 1 ELSE 0 END) as cancelled,
        MAX(c.created_at) as last_count_date
      FROM branches b
      LEFT JOIN counts c ON c.branch_id = b.id
      GROUP BY b.id, b.name
      ORDER BY total DESC
    `);
        // 3. Conteos recientes (últimos 15)
        const [recentRows] = await this.pool.execute(`
      SELECT
        c.id,
        c.folio,
        c.status,
        c.type,
        c.classification,
        c.created_at,
        c.scheduled_date,
        c.started_at,
        c.closed_at,
        b.name as branch_name,
        u.name as responsible_name
      FROM counts c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN users u ON u.id = c.responsible_user_id
      ORDER BY c.created_at DESC
      LIMIT 15
    `);
        return {
            total_counts: Number(global.total_counts ?? 0),
            pending_counts: Number(global.pending_counts ?? 0),
            in_progress_counts: Number(global.in_progress_counts ?? 0),
            finished_counts: Number(global.finished_counts ?? 0),
            closed_counts: Number(global.closed_counts ?? 0),
            cancelled_counts: Number(global.cancelled_counts ?? 0),
            scheduled_today: Number(global.scheduled_today ?? 0),
            by_branch: branchRows.map(b => ({
                branch_id: b.branch_id,
                branch_name: b.branch_name,
                total: Number(b.total ?? 0),
                pending: Number(b.pending ?? 0),
                in_progress: Number(b.in_progress ?? 0),
                finished: Number(b.finished ?? 0),
                closed: Number(b.closed ?? 0),
                cancelled: Number(b.cancelled ?? 0),
                last_count_date: b.last_count_date ?? null
            })),
            recent_counts: recentRows.map(c => ({
                id: c.id,
                folio: c.folio,
                status: c.status,
                type: c.type,
                classification: c.classification,
                branch_name: c.branch_name ?? '',
                responsible_name: c.responsible_name ?? '',
                scheduled_date: c.scheduled_date ?? null,
                created_at: c.created_at
            }))
        };
    }
    /**
     * Elimina un conteo (soft delete cambiando estado)
     */
    async deleteCount(id, userId) {
        const existing = await this.getCountById(id);
        await this.pool.execute('DELETE FROM counts WHERE id = ?', [id]);
        logger_1.logger.info(`Count ${id} deleted`);
        await AuditService_1.auditService.log({
            user_id: userId,
            action: 'DELETE_COUNT',
            entity_type: 'count',
            entity_id: id,
            old_values: existing
        });
    }
    /**
     * Lista diferencias registradas en detalles de conteo
     */
    async listDifferences() {
        const [rows] = await this.pool.execute(`
      SELECT
        cd.*,
        c.folio,
        c.branch_id
      FROM count_details cd
      INNER JOIN counts c ON c.id = cd.count_id
      WHERE cd.counted_stock IS NOT NULL
        AND cd.counted_stock != cd.system_stock
      ORDER BY cd.updated_at DESC
      `);
        return rows;
    }
}
exports.CountsService = CountsService;
exports.default = CountsService;
//# sourceMappingURL=CountsService.js.map