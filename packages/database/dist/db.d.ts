import sqlite3 from 'sqlite3';
export declare class Database {
    db: sqlite3.Database;
    constructor(dbPath: string);
    init(): Promise<void>;
    run(sql: string, params?: any[]): Promise<{
        lastID: number;
        changes: number;
    }>;
    get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
    all<T = any>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
}
