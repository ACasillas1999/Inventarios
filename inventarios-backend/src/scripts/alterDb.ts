import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_LOCAL_HOST || 'localhost',
    port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
    user: process.env.DB_LOCAL_USER || 'root',
    password: process.env.DB_LOCAL_PASSWORD || '',
    database: process.env.DB_LOCAL_DATABASE || 'inventarios'
  });
  console.log('Connected to MySQL local database.');
  
  // Alter counts table priority column
  await connection.execute(`
    ALTER TABLE counts 
    MODIFY COLUMN priority ENUM('baja', 'media', 'alta', 'urgente', 'mostrador') DEFAULT 'media'
  `);
  console.log('Successfully altered counts.priority column.');
  
  await connection.end();
}

run().catch(console.error);
