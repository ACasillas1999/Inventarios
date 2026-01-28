/**
 * Script para crear usuarios manualmente
 *
 * Uso:
 *   npx tsx scripts/createUser.ts <email> <password> <name> <role_id>
 *
 * Ejemplo:
 *   npx tsx scripts/createUser.ts usuario@test.com test123 "Usuario Prueba" 2
 *
 * Roles disponibles:
 *   1 = Admin (acceso total)
 *   2 = Inventarios (crear/capturar conteos)
 *   3 = Auditor (solo lectura)
 *   4 = Sucursal (acceso limitado a su sucursal)
 */

import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

interface UserInput {
  email: string
  password: string
  name: string
  role_id: number
}

async function createUser(userData: UserInput) {
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

    console.log('✅ Conectado a la base de datos')

    // Verificar si el email ya existe
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [userData.email]
    )

    if (Array.isArray(existing) && existing.length > 0) {
      console.error(`❌ Error: El usuario con email "${userData.email}" ya existe`)
      process.exit(1)
    }

    // Validar que el role_id existe
    const [roles] = await connection.execute(
      'SELECT id, name FROM roles WHERE id = ?',
      [userData.role_id]
    )

    if (!Array.isArray(roles) || roles.length === 0) {
      console.error(`❌ Error: El role_id ${userData.role_id} no existe`)
      console.log('\nRoles disponibles:')
      const [allRoles] = await connection.execute('SELECT id, name, description FROM roles')
      if (Array.isArray(allRoles)) {
        allRoles.forEach((role: any) => {
          console.log(`  ${role.id} - ${role.name}: ${role.description}`)
        })
      }
      process.exit(1)
    }

    const roleName = (roles as any[])[0].name

    // Hashear la contraseña
    console.log('🔒 Hasheando contraseña...')
    const passwordHash = await bcrypt.hash(userData.password, 10)

    // Insertar el usuario
    const [result] = await connection.execute(
      `INSERT INTO users (email, password, name, role_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
      [userData.email, passwordHash, userData.name, userData.role_id]
    )

    const insertResult = result as mysql.ResultSetHeader
    const userId = insertResult.insertId

    console.log('\n✅ Usuario creado exitosamente!')
    console.log('\n📋 Detalles:')
    console.log(`   ID: ${userId}`)
    console.log(`   Email: ${userData.email}`)
    console.log(`   Nombre: ${userData.name}`)
    console.log(`   Rol: ${roleName} (ID: ${userData.role_id})`)
    console.log(`   Contraseña: ${userData.password}`)
    console.log(`   Estado: active`)
    console.log('\n🔑 Puedes usar estas credenciales para hacer login')

  } catch (error: any) {
    console.error('❌ Error al crear usuario:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

// Main
const args = process.argv.slice(2)

if (args.length < 4) {
  console.log('❌ Faltan argumentos\n')
  console.log('Uso:')
  console.log('  npx tsx scripts/createUser.ts <email> <password> <name> <role_id>\n')
  console.log('Ejemplo:')
  console.log('  npx tsx scripts/createUser.ts usuario@test.com test123 "Usuario Prueba" 2\n')
  console.log('Roles disponibles:')
  console.log('  1 = Admin (acceso total)')
  console.log('  2 = Inventarios (crear/capturar conteos)')
  console.log('  3 = Auditor (solo lectura)')
  console.log('  4 = Sucursal (acceso limitado a su sucursal)\n')
  process.exit(1)
}

const [email, password, name, roleIdStr] = args
const role_id = parseInt(roleIdStr)

if (isNaN(role_id)) {
  console.error('❌ Error: role_id debe ser un número')
  process.exit(1)
}

if (!email.includes('@')) {
  console.error('❌ Error: email inválido')
  process.exit(1)
}

if (password.length < 6) {
  console.error('❌ Error: la contraseña debe tener al menos 6 caracteres')
  process.exit(1)
}

createUser({ email, password, name, role_id })
