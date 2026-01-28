"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Script para inicializar la base de datos local
 */
const initDatabase = async () => {
    console.log('🔧 Initializing database...');
    try {
        // Conectar a MySQL sin especificar base de datos
        const connection = await promise_1.default.createConnection({
            host: process.env.DB_LOCAL_HOST || 'localhost',
            port: parseInt(process.env.DB_LOCAL_PORT || '3306'),
            user: process.env.DB_LOCAL_USER || 'root',
            password: process.env.DB_LOCAL_PASSWORD || '',
            multipleStatements: true
        });
        console.log('✓ Connected to MySQL server');
        // Leer el archivo SQL
        const schemaPath = path_1.default.join(process.cwd(), 'database', 'schema.sql');
        const schema = fs_1.default.readFileSync(schemaPath, 'utf8');
        console.log('✓ Schema file loaded');
        // Ejecutar el script SQL
        await connection.query(schema);
        console.log('✓ Database and tables created');
        await connection.end();
        console.log('🎉 Database initialized successfully!');
    }
    catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    }
};
// Ejecutar
initDatabase();
//# sourceMappingURL=initDatabase.js.map