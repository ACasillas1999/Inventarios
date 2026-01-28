
import { getLocalPool } from '../src/config/database';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const runMigration = async () => {
    try {
        const sqlPath = path.join(__dirname, '../../database/migrations/002_add_classification_to_counts.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Reading migration file:', sqlPath);
        console.log('SQL Content:', sql);

        const pool = getLocalPool();
        // Split by semicolon to run multiple statements if needed, though execute might handle one by one
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const stmt of statements) {
             console.log('Executing:', stmt);
             await pool.execute(stmt);
        }

        console.log('Migration executed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
