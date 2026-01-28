import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Script para inicializar la base de datos local
 */
const initDatabase = async (): Promise<void> => {
  console.log('🔧 Initializing database...')

  try {
    // Conectar a MySQL sin especificar base de datos
    const connection = await mysql.createConnection({
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
      user: process.env.DB_LOCAL_USER || 'root',
      password: process.env.DB_LOCAL_PASSWORD || '',
      multipleStatements: true
    })

    console.log('✓ Connected to MySQL server')

    // Leer el archivo SQL
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    console.log('✓ Schema file loaded')

    // Ejecutar el script SQL
    await connection.query(schema)

    console.log('✓ Database and tables created')

    await connection.end()

    console.log('🎉 Database initialized successfully!')
  } catch (error) {
    console.error('❌ Error initializing database:', error)
    process.exit(1)
  }
}

// Ejecutar
initDatabase()
