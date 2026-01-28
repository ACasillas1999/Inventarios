import mysql from 'mysql2/promise';
export declare const localDbConfig: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    waitForConnections: boolean;
    connectionLimit: number;
    queueLimit: number;
    enableKeepAlive: boolean;
    keepAliveInitialDelay: number;
    charset: string;
    timezone: string;
};
export declare const getLocalPool: () => mysql.Pool;
export declare const closeLocalPool: () => Promise<void>;
export interface BranchDbConfig {
    id: number;
    code: string;
    name: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    poolMin?: number;
    poolMax?: number;
}
export declare const getBranchDatabases: () => Promise<BranchDbConfig[]>;
export declare const cacheConfig: {
    ttlStock: number;
    ttlItems: number;
    ttlConfig: number;
};
//# sourceMappingURL=database.d.ts.map