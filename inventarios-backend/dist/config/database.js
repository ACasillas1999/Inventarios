"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheConfig = exports.getBranchDatabases = exports.closeLocalPool = exports.getLocalPool = exports.localDbConfig = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configuración de la base de datos local
exports.localDbConfig = {
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
};
// Pool de conexiones para la base de datos local
let localPool = null;
const getLocalPool = () => {
    if (!localPool) {
        localPool = promise_1.default.createPool(exports.localDbConfig);
    }
    return localPool;
};
exports.getLocalPool = getLocalPool;
const closeLocalPool = async () => {
    if (localPool) {
        await localPool.end();
        localPool = null;
    }
};
exports.closeLocalPool = closeLocalPool;
const getBranchDatabases = async () => {
    try {
        const pool = (0, exports.getLocalPool)();
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
    `);
        return rows.map(row => ({
            id: row.id,
            code: row.code,
            name: row.name,
            host: row.host,
            port: row.port,
            user: row.user,
            password: row.password,
            database: row.database
        }));
    }
    catch (error) {
        console.error('Error loading branches from database:', error);
        return [];
    }
};
exports.getBranchDatabases = getBranchDatabases;
// Configuración de caché
exports.cacheConfig = {
    ttlStock: parseInt(process.env.CACHE_TTL_STOCK || '300'), // 5 minutos
    ttlItems: parseInt(process.env.CACHE_TTL_ITEMS || '3600'), // 1 hora
    ttlConfig: parseInt(process.env.CACHE_TTL_CONFIG || '1800') // 30 minutos
};
//# sourceMappingURL=database.js.map