const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_LOCAL_HOST || 'localhost',
  port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
  user: process.env.DB_LOCAL_USER || 'root',
  password: process.env.DB_LOCAL_PASSWORD || '',
  database: process.env.DB_LOCAL_DATABASE || 'inventarios'
};

async function checkRoles() {
  const connection = await mysql.createConnection(config);
  try {
    const [roles] = await connection.execute('SELECT id, name FROM roles');
    console.log('Roles found:', roles);
    
    // Also check current users and their roles
    const [users] = await connection.execute('SELECT id, email, role_id FROM users LIMIT 10');
    console.log('Sample users:', users);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkRoles();
