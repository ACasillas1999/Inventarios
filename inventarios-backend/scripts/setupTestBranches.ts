/**
 * Script para configurar bases de datos de prueba de sucursales
 *
 * Esto te permite probar el sistema completo mientras esperas las credenciales reales.
 *
 * Uso:
 *   npx tsx scripts/setupTestBranches.ts
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config()

async function setupTestBranches() {
  let connection: mysql.Connection | null = null

  try {
    console.log('🔧 Configurando bases de datos de prueba para sucursales...\n')

    // Conectar como root para crear las bases de datos
    connection = await mysql.createConnection({
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
      user: process.env.DB_LOCAL_USER || 'root',
      password: process.env.DB_LOCAL_PASSWORD || '',
      multipleStatements: true
    })

    console.log('✅ Conectado a MySQL\n')

    // Leer el script SQL
    const sqlPath = join(__dirname, '..', 'database', 'test-branches.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    console.log('📄 Ejecutando script SQL...')
    await connection.query(sql)
    console.log('✅ Bases de datos y usuarios creados\n')

    await connection.end()

    // Ahora conectar a la base de datos local para registrar las sucursales
    connection = await mysql.createConnection({
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
      user: process.env.DB_LOCAL_USER || 'root',
      password: process.env.DB_LOCAL_PASSWORD || '',
      database: process.env.DB_LOCAL_DATABASE || 'inventarios'
    })

    console.log('📝 Registrando sucursales en la base de datos local...\n')

    // Primero, eliminar sucursales de prueba existentes
    await connection.execute(`DELETE FROM branches WHERE code IN ('TEST001', 'TEST002', 'TEST003')`)

    // Insertar las 3 sucursales de prueba
    const branches = [
      {
        code: 'TEST001',
        name: 'Tienda Centro (Prueba)',
        db_host: 'localhost',
        db_port: 3306,
        db_user: 'readonly_centro',
        db_password: 'centro123',
        db_database: 'tienda_centro',
        status: 'active'
      },
      {
        code: 'TEST002',
        name: 'Tienda Norte (Prueba)',
        db_host: 'localhost',
        db_port: 3306,
        db_user: 'readonly_norte',
        db_password: 'norte123',
        db_database: 'tienda_norte',
        status: 'active'
      },
      {
        code: 'TEST003',
        name: 'Tienda Sur (Prueba)',
        db_host: 'localhost',
        db_port: 3306,
        db_user: 'readonly_sur',
        db_password: 'sur123',
        db_database: 'tienda_sur',
        status: 'active'
      }
    ]

    for (const branch of branches) {
      await connection.execute(
        `INSERT INTO branches (code, name, db_host, db_port, db_user, db_password, db_database, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          branch.code,
          branch.name,
          branch.db_host,
          branch.db_port,
          branch.db_user,
          branch.db_password,
          branch.db_database,
          branch.status
        ]
      )
      console.log(`  ✅ ${branch.name} registrada (${branch.code})`)
    }

    console.log('\n✅ ¡Configuración completada exitosamente!\n')
    console.log('═'.repeat(60))
    console.log('📊 BASES DE DATOS CREADAS:')
    console.log('═'.repeat(60))
    console.log('1. tienda_centro')
    console.log('   Usuario: readonly_centro')
    console.log('   Password: centro123')
    console.log('   Artículos: 10 productos de prueba')
    console.log('')
    console.log('2. tienda_norte')
    console.log('   Usuario: readonly_norte')
    console.log('   Password: norte123')
    console.log('   Artículos: 10 productos de prueba')
    console.log('')
    console.log('3. tienda_sur')
    console.log('   Usuario: readonly_sur')
    console.log('   Password: sur123')
    console.log('   Artículos: 10 productos de prueba')
    console.log('═'.repeat(60))
    console.log('\n🔄 SIGUIENTE PASO:')
    console.log('   Reinicia el backend para que detecte las nuevas sucursales:')
    console.log('   $ npm run dev')
    console.log('\n💡 NOTA:')
    console.log('   Cada tienda tiene diferentes cantidades del mismo catálogo')
    console.log('   para simular existencias reales en múltiples sucursales.')
    console.log('')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Verifica la contraseña de MySQL en el archivo .env')
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

setupTestBranches()
