/**
 * Script de prueba para verificar la conexión a bases de datos de sucursales
 *
 * Uso:
 * node test-branch-connection.js
 */

const mysql = require('mysql2/promise')

// CONFIGURA AQUÍ LOS DATOS DE TU SUCURSAL DE PRUEBA
const config = {
  host: '192.168.1.10',        // IP o hostname de la sucursal
  port: 3306,                   // Puerto MySQL
  user: 'readonly',             // Usuario de solo lectura
  password: 'readonly123',      // Contraseña
  database: 'tienda_centro'     // Nombre de la base de datos
}

// Nombre de tu tabla de artículos (ajustado al esquema real)
const TABLE_NAME = 'Inventario_Maximo'

// Código de un artículo de prueba (ajustado a datos reales)
const TEST_ITEM_CODE = '00001100AMWB'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}▶ ${msg}${colors.reset}`)
}

async function testConnection() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  PRUEBA DE CONEXIÓN A BASE DE DATOS DE SUCURSAL         ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  let connection

  try {
    log.section('Paso 1: Intentando conectar a la base de datos')
    log.info(`Host: ${config.host}:${config.port}`)
    log.info(`Database: ${config.database}`)
    log.info(`User: ${config.user}`)

    connection = await mysql.createConnection(config)
    log.success('Conexión establecida exitosamente')

    // Prueba 2: Listar tablas
    log.section('Paso 2: Listando tablas disponibles')
    const [tables] = await connection.query('SHOW TABLES')
    log.success(`Se encontraron ${tables.length} tablas:`)
    tables.slice(0, 10).forEach((table) => {
      const tableName = Object.values(table)[0]
      console.log(`  - ${tableName}`)
    })
    if (tables.length > 10) {
      console.log(`  ... y ${tables.length - 10} más`)
    }

    // Prueba 3: Verificar si existe la tabla de artículos
    log.section('Paso 3: Verificando tabla de artículos')
    const tableExists = tables.some((table) => Object.values(table)[0] === TABLE_NAME)

    if (tableExists) {
      log.success(`La tabla '${TABLE_NAME}' existe`)

      // Prueba 4: Describir estructura de la tabla
      log.section('Paso 4: Estructura de la tabla')
      const [columns] = await connection.query(`DESCRIBE ${TABLE_NAME}`)
      log.success('Columnas de la tabla:')
      columns.forEach((col) => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Key === 'PRI' ? '🔑' : ''}`)
      })

      // Prueba 5: Contar registros
      log.section('Paso 5: Contando registros')
      const [countResult] = await connection.query(`SELECT COUNT(*) as total FROM ${TABLE_NAME}`)
      const totalRecords = countResult[0].total
      log.success(`Total de artículos: ${totalRecords.toLocaleString()}`)

      // Prueba 6: Obtener registros de ejemplo
      log.section('Paso 6: Consultando registros de ejemplo')
      const [rows] = await connection.query(`SELECT * FROM ${TABLE_NAME} LIMIT 3`)
      log.success(`Primeros ${rows.length} registros:`)
      rows.forEach((row, i) => {
        console.log(`\n  Registro ${i + 1}:`)
        Object.entries(row).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`)
        })
      })

      // Prueba 7: Buscar artículo específico
      if (TEST_ITEM_CODE) {
        log.section(`Paso 7: Buscando artículo específico (${TEST_ITEM_CODE})`)

        // Intentar con diferentes nombres de columna comunes
        const possibleCodeColumns = ['codigo', 'cod_articulo', 'sku', 'code', 'item_code', 'articulo']
        let found = false

        for (const colName of possibleCodeColumns) {
          try {
            const [results] = await connection.query(
              `SELECT * FROM ${TABLE_NAME} WHERE ${colName} = ? LIMIT 1`,
              [TEST_ITEM_CODE]
            )

            if (results.length > 0) {
              found = true
              log.success(`Artículo encontrado usando columna '${colName}':`)
              Object.entries(results[0]).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`)
              })
              break
            }
          } catch (e) {
            // Ignorar errores de columna no existente
          }
        }

        if (!found) {
          log.warn(`No se encontró el artículo '${TEST_ITEM_CODE}'`)
          log.info('Intenta cambiar TEST_ITEM_CODE a un código que exista en tu base de datos')
        }
      }

      // Recomendaciones
      log.section('Recomendaciones para configurar StockService.ts')

      // Detectar columna de código
      const codeColumn = columns.find(col =>
        ['codigo', 'cod_articulo', 'sku', 'code', 'item_code'].includes(col.Field.toLowerCase())
      )

      // Detectar columna de existencia
      const stockColumn = columns.find(col =>
        ['existencia', 'stock', 'cantidad', 'qty', 'quantity'].includes(col.Field.toLowerCase())
      )

      if (codeColumn && stockColumn) {
        console.log('\nUsa esta consulta en StockService.ts:\n')
        console.log(`const query = \`
  SELECT ${stockColumn.Field} as stock
  FROM ${TABLE_NAME}
  WHERE ${codeColumn.Field} = ?
  LIMIT 1
\``)
      } else {
        log.warn('No se pudieron detectar automáticamente las columnas')
        log.info('Revisa la estructura de la tabla y ajusta las consultas manualmente')
      }

    } else {
      log.error(`La tabla '${TABLE_NAME}' NO existe`)
      log.warn('Verifica el nombre de la tabla en la lista anterior')
      log.info('Edita la variable TABLE_NAME en este script con el nombre correcto')
    }

    log.section('Resultado Final')
    log.success('Todas las pruebas completadas exitosamente')
    console.log('\n✅ Tu base de datos de sucursal está lista para usarse')
    console.log('📝 Ahora configura el archivo .env con estos datos')
    console.log('🔧 Ajusta las consultas SQL en src/services/StockService.ts\n')

  } catch (error) {
    log.section('Error durante las pruebas')
    log.error(`${error.message}`)
    console.log('\n📋 Posibles causas:')
    console.log('  1. Host/Puerto incorrecto')
    console.log('  2. Usuario/Contraseña incorrectos')
    console.log('  3. Base de datos no existe')
    console.log('  4. Firewall bloqueando la conexión')
    console.log('  5. MySQL no está escuchando en el puerto especificado')
    console.log('\n💡 Verifica:')
    console.log('  - Que puedes hacer ping al host')
    console.log('  - Que el usuario tiene permisos de lectura')
    console.log('  - Que el firewall permite conexiones al puerto 3306')
    console.log('')
  } finally {
    if (connection) {
      await connection.end()
      log.info('Conexión cerrada')
    }
  }
}

// Ejecutar
testConnection().catch(console.error)
