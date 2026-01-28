import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

// Configuración de la base de datos local
export const localDbConfig = {
  host: process.env.DB_LOCAL_HOST || 'localhost',
  port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
  user: process.env.DB_LOCAL_USER || 'root',
  password: process.env.DB_LOCAL_PASSWORD || '',
  database: process.env.DB_LOCAL_DATABASE || 'inventarios',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_LOCAL_POOL_MAX || '20'),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  // Usar timezone local para evitar desfases al serializar timestamps a ISO (UTC) en la API
  timezone: 'local'
}

// Pool de conexiones para la base de datos local
let localPool: mysql.Pool | null = null

export const getLocalPool = (): mysql.Pool => {
  if (!localPool) {
    localPool = mysql.createPool(localDbConfig)
  }
  return localPool
}

export const closeLocalPool = async (): Promise<void> => {
  if (localPool) {
    await localPool.end()
    localPool = null
  }
}

// Configuración de bases de datos de sucursales
export interface BranchDbConfig {
  id: number
  code: string
  name: string
  host: string
  port: number
  user: string
  password: string
  database: string
  poolMin?: number
  poolMax?: number
}

export const getBranchDatabases = async (): Promise<BranchDbConfig[]> => {
  try {
    const pool = getLocalPool()
    const [rows] = await pool.query(`
      SELECT
        id,
        code,
        name,
        db_host as host,
        db_port as port,
        db_user as \`user\`,
        db_password as \`password\`,
        db_database as \`database\`
      FROM branches
      WHERE status = 'active'
      ORDER BY name ASC
    `)

    return (rows as any[]).map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      host: row.host,
      port: row.port,
      user: row.user,
      password: row.password,
      database: row.database
    }))
  } catch (error) {
    console.error('Error loading branches from database:', error)
    return []
  }
}

// Configuración de caché
export const cacheConfig = {
  ttlStock: parseInt(process.env.CACHE_TTL_STOCK || '300'), // 5 minutos
  ttlItems: parseInt(process.env.CACHE_TTL_ITEMS || '3600'), // 1 hora
  ttlConfig: parseInt(process.env.CACHE_TTL_CONFIG || '1800') // 30 minutos
}
