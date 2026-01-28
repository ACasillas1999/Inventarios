/**
 * Script para listar todos los usuarios en la base de datos
 *
 * Uso:
 *   npx tsx scripts/listUsers.ts
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function listUsers() {
  let connection: mysql.Connection | null = null

  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
      user: process.env.DB_LOCAL_USER || 'root',
      password: process.env.DB_LOCAL_PASSWORD || '',
      database: process.env.DB_LOCAL_DATABASE || 'inventarios',
    })

    console.log('✅ Conectado a la base de datos\n')

    // Obtener todos los usuarios
    const [users] = await connection.execute(
      `SELECT u.id, u.email, u.name, u.status, r.name as role_name, u.created_at, u.last_login
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.id`
    )

    if (!Array.isArray(users) || users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos')
      console.log('\n💡 Ejecuta "npm run db:init" para crear el usuario admin por defecto')
      process.exit(0)
    }

    console.log(`📋 Usuarios en la base de datos (${users.length} total):\n`)
    console.log('─'.repeat(100))
    console.log(
      'ID'.padEnd(5) +
      'Email'.padEnd(30) +
      'Nombre'.padEnd(25) +
      'Rol'.padEnd(15) +
      'Estado'.padEnd(10) +
      'Último login'
    )
    console.log('─'.repeat(100))

    users.forEach((user: any) => {
      const lastLogin = user.last_login
        ? new Date(user.last_login).toLocaleString('es-MX')
        : 'Nunca'

      console.log(
        String(user.id).padEnd(5) +
        user.email.padEnd(30) +
        user.name.padEnd(25) +
        (user.role_name || 'N/A').padEnd(15) +
        user.status.padEnd(10) +
        lastLogin
      )
    })

    console.log('─'.repeat(100))
    console.log('\n💡 Usuarios activos:', users.filter((u: any) => u.status === 'active').length)
    console.log('💡 Usuarios inactivos:', users.filter((u: any) => u.status !== 'active').length)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

listUsers()
