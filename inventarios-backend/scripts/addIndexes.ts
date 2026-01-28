import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Script para agregar índices a la base de datos de Tapatía
 * Esto mejorará significativamente el rendimiento de las consultas
 */
async function addIndexes() {
  let connection: mysql.Connection | null = null

  try {
    // Conectar a la base de datos de Tapatía
    console.log('🔌 Conectando a Tapatía...')
    connection = await mysql.createConnection({
      host: '192.168.60.42',
      port: 3306,
      user: 'consulta',
      password: 'qry3026',
      database: 'tapatia'
    })

    console.log('✅ Conectado a Tapatía\n')

    // Función auxiliar para crear índice si no existe
    async function createIndexIfNotExists(
      tableName: string,
      indexName: string,
      columns: string
    ) {
      try {
        // Verificar si el índice ya existe
        const [indexes] = await connection!.query(
          `SHOW INDEX FROM ${tableName} WHERE Key_name = ?`,
          [indexName]
        )

        if (Array.isArray(indexes) && indexes.length > 0) {
          console.log(`⏭️  Índice ${indexName} ya existe en ${tableName}`)
          return
        }

        // Crear el índice
        console.log(`📝 Creando índice ${indexName} en ${tableName}...`)
        await connection!.query(
          `CREATE INDEX ${indexName} ON ${tableName} (${columns})`
        )
        console.log(`✅ Índice ${indexName} creado exitosamente\n`)
      } catch (error: any) {
        console.error(`❌ Error creando índice ${indexName}:`, error.message)
      }
    }

    console.log('📊 Agregando índices a la tabla articulo...\n')

    // Índice para búsqueda por código
    await createIndexIfNotExists('articulo', 'idx_clave_articulo', 'Clave_Articulo')

    // Índice para búsqueda por descripción
    await createIndexIfNotExists('articulo', 'idx_descripcion', 'Descripcion(100)')

    // Índice para filtro por línea
    await createIndexIfNotExists('articulo', 'idx_linea', 'Linea')

    // Índice compuesto para línea + código (muy importante para paginación)
    await createIndexIfNotExists(
      'articulo',
      'idx_linea_clave',
      'Linea, Clave_Articulo'
    )

    console.log('📊 Agregando índices a la tabla articuloalm...\n')

    // Índice para JOIN con articulo
    await createIndexIfNotExists(
      'articuloalm',
      'idx_clave_articulo_alm',
      'Clave_Articulo'
    )

    // Índice para búsqueda por almacén
    await createIndexIfNotExists('articuloalm', 'idx_almacen', 'Almacen')

    // Índice compuesto para código + almacén
    await createIndexIfNotExists(
      'articuloalm',
      'idx_clave_almacen',
      'Clave_Articulo, Almacen'
    )

    console.log('\n✅ Todos los índices han sido procesados')
    console.log('\n📋 Verificando índices creados...\n')

    // Mostrar índices de articulo
    const [articuloIndexes] = await connection.query('SHOW INDEX FROM articulo')
    console.log('Índices en articulo:')
    if (Array.isArray(articuloIndexes)) {
      const uniqueIndexes = new Set<string>()
      articuloIndexes.forEach((idx: any) => {
        uniqueIndexes.add(idx.Key_name)
      })
      uniqueIndexes.forEach((name) => {
        console.log(`  - ${name}`)
      })
    }

    console.log('\nÍndices en articuloalm:')
    const [articuloalmIndexes] = await connection.query('SHOW INDEX FROM articuloalm')
    if (Array.isArray(articuloalmIndexes)) {
      const uniqueIndexes = new Set<string>()
      articuloalmIndexes.forEach((idx: any) => {
        uniqueIndexes.add(idx.Key_name)
      })
      uniqueIndexes.forEach((name) => {
        console.log(`  - ${name}`)
      })
    }

    console.log(
      '\n✨ Los índices mejorarán significativamente el rendimiento de las consultas'
    )
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      console.log('\n👋 Conexión cerrada')
    }
  }
}

addIndexes()
