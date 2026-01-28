/**
 * Script para agregar una sucursal real al sistema
 *
 * Uso:
 *   npx tsx scripts/addRealBranch.ts
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function addRealBranch() {
  let connection: mysql.Connection | null = null

  try {
    console.log('🔧 Agregando sucursal real al sistema...\n')

    // Conectar a la base de datos local
    connection = await mysql.createConnection({
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
      user: process.env.DB_LOCAL_USER || 'root',
      password: process.env.DB_LOCAL_PASSWORD || '',
      database: process.env.DB_LOCAL_DATABASE || 'inventarios'
    })

    console.log('✅ Conectado a MySQL\n')

    // Datos de la sucursal real
    const branch = {
      code: 'TAPATIA',
      name: 'Tapatía',
      db_host: '192.168.60.42',
      db_port: 3306,
      db_user: 'consulta',
      db_password: 'qry3026',
      db_database: 'tapatia',
      status: 'active'
    }

    // Verificar si ya existe
    const [existing] = await connection.execute(
      'SELECT id FROM branches WHERE code = ?',
      [branch.code]
    )

    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`⚠️  La sucursal ${branch.code} ya existe. Actualizando...`)

      await connection.execute(
        `UPDATE branches
         SET name = ?, db_host = ?, db_port = ?, db_user = ?, db_password = ?, db_database = ?, status = ?
         WHERE code = ?`,
        [
          branch.name,
          branch.db_host,
          branch.db_port,
          branch.db_user,
          branch.db_password,
          branch.db_database,
          branch.status,
          branch.code
        ]
      )

      console.log(`✅ Sucursal ${branch.name} actualizada`)
    } else {
      // Insertar la sucursal
      await connection.execute(
        `INSERT INTO branches (code, name, db_host, db_port, db_user, db_password, db_database, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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

      console.log(`✅ Sucursal ${branch.name} agregada correctamente`)
    }

    console.log('\n═'.repeat(60))
    console.log('📊 SUCURSAL CONFIGURADA:')
    console.log('═'.repeat(60))
    console.log(`Código: ${branch.code}`)
    console.log(`Nombre: ${branch.name}`)
    console.log(`Host: ${branch.db_host}`)
    console.log(`Puerto: ${branch.db_port}`)
    console.log(`Base de datos: ${branch.db_database}`)
    console.log(`Usuario: ${branch.db_user}`)
    console.log('═'.repeat(60))
    console.log('\n🔄 SIGUIENTE PASO:')
    console.log('   Reinicia el backend para que detecte la nueva sucursal:')
    console.log('   $ npm run dev')
    console.log('')

    // Intentar probar la conexión
    console.log('🔍 Probando conexión a la sucursal...\n')

    try {
      const branchConnection = await mysql.createConnection({
        host: branch.db_host,
        port: branch.db_port,
        user: branch.db_user,
        password: branch.db_password,
        database: branch.db_database
      })

      await branchConnection.query('SELECT 1')
      console.log('✅ Conexión exitosa a la sucursal Tapatía!')

      // Probar si existe la tabla articuloalm
      const [tables] = await branchConnection.query(
        "SHOW TABLES LIKE 'articuloalm'"
      )

      if (Array.isArray(tables) && tables.length > 0) {
        console.log('✅ Tabla articuloalm encontrada')

        // Contar registros
        const [count] = await branchConnection.query(
          'SELECT COUNT(*) as total FROM articuloalm'
        ) as any

        console.log(`📦 Total de artículos: ${count[0].total}`)

        // Mostrar una muestra de los primeros registros
        const [sample] = await branchConnection.query(
          'SELECT * FROM articuloalm LIMIT 3'
        ) as any

        if (sample && sample.length > 0) {
          console.log('\n📋 Muestra de campos en la tabla:')
          console.log('   Columnas:', Object.keys(sample[0]).join(', '))
        }
      } else {
        console.log('⚠️  Tabla articuloalm no encontrada')
        console.log('   Verifica el nombre de la tabla en la base de datos')

        // Mostrar todas las tablas disponibles
        const [allTables] = await branchConnection.query('SHOW TABLES')
        console.log('\n📋 Tablas disponibles en la base de datos:')
        if (Array.isArray(allTables)) {
          allTables.forEach((table: any) => {
            console.log(`   - ${Object.values(table)[0]}`)
          })
        }
      }

      await branchConnection.end()
    } catch (testError: any) {
      console.error('❌ Error al probar conexión:', testError.message)
      console.log('\n💡 Posibles causas:')
      console.log('   - El host 192.168.60.42 no es accesible desde esta máquina')
      console.log('   - El firewall está bloqueando el puerto 3306')
      console.log('   - Las credenciales son incorrectas')
      console.log('   - El usuario no tiene permisos desde esta IP')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

addRealBranch()
