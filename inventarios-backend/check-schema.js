const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_LOCAL_HOST || 'localhost',
  port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
  user: process.env.DB_LOCAL_USER || 'root',
  password: process.env.DB_LOCAL_PASSWORD || '',
  database: process.env.DB_LOCAL_DATABASE || 'inventarios'
};

async function checkSchema() {
  const connection = await mysql.createConnection(config);
  try {
    console.log('--- counts table ---');
    const [countsCols] = await connection.execute('DESCRIBE counts');
    console.table(countsCols);
    
    console.log('--- count_details table ---');
    const [detailsCols] = await connection.execute('DESCRIBE count_details');
    console.table(detailsCols);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkSchema();
