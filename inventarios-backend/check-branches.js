const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_LOCAL_HOST || 'localhost',
  port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
  user: process.env.DB_LOCAL_USER || 'root',
  password: process.env.DB_LOCAL_PASSWORD || '',
  database: process.env.DB_LOCAL_DATABASE || 'inventarios'
};

async function checkBranches() {
  try {
    const connection = await mysql.createConnection(config);
    console.log('Connected to local DB');
    
    console.log('--- branches table ---');
    const [branches] = await connection.execute('SELECT id, code, name, status, db_database FROM branches');
    console.table(branches);
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
    // If ECONNREFUSED, maybe try another host? 
    // Wait, the backend usually connects to localhost if the DB is on the same machine.
  }
}

checkBranches();
