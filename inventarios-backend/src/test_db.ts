import { getLocalPool } from './config/database';

async function testQuery() {
    const pool = getLocalPool();
    try {
        console.log('Testing connection...');
        const [rows] = await pool.execute<any[]>(`
            SELECT COUNT(*) as total
            FROM count_details cd
            INNER JOIN counts c ON c.id = cd.count_id
            WHERE cd.counted_stock IS NOT NULL
              AND cd.counted_stock != cd.system_stock
        `);
        console.log('Total differences in DB:', rows[0].total);
        
        if (rows[0].total > 0) {
            const [data] = await pool.execute<any[]>(`
                SELECT cd.id, cd.item_code, c.branch_id
                FROM count_details cd
                INNER JOIN counts c ON c.id = cd.count_id
                WHERE cd.counted_stock IS NOT NULL
                  AND cd.counted_stock != cd.system_stock
                LIMIT 5
            `);
            console.log('Sample differences:', data);
        } else {
            console.log('NO DIFFERENCES FOUND in DB with criteria: counted_stock IS NOT NULL AND counted_stock != system_stock');
            
            const [countDetails] = await pool.execute<any[]>('SELECT COUNT(*) as total FROM count_details');
            console.log('Total records in count_details:', countDetails[0].total);

            const [countDetailsSample] = await pool.execute<any[]>('SELECT counted_stock, system_stock FROM count_details LIMIT 5');
            console.log('Sample count_details:', countDetailsSample);
        }
    } catch (err) {
        console.error('Error executing test query:', err);
    } finally {
        // pool.end() might throw if using a global pool that others are using, 
        // but here it's likely okay for a one-off script
        await pool.end();
    }
}

testQuery();
