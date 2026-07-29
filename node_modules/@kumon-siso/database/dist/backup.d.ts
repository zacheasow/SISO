import { Database } from './db.js';
export declare class BackupService {
    private db;
    private dbPath;
    constructor(db: Database, dbPath: string);
    /**
     * Performs an integrity check on the SQLite database.
     */
    checkIntegrity(): Promise<{
        ok: boolean;
        message: string;
    }>;
    /**
     * Creates a backup copy of the current SQLite database to the specified target directory.
     */
    createBackup(targetDirectory: string): Promise<{
        success: boolean;
        backupFilePath: string;
        checksum: string;
    }>;
    /**
     * Export a complete center migration transfer package containing database, manifest, and checksum.
     */
    exportTransferPackage(exportDir: string): Promise<string>;
    /**
     * Restores database from a verified transfer package path.
     */
    static restoreFromPackage(packageDirPath: string, targetDbPath: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
