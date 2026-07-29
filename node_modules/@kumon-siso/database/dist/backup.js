"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
class BackupService {
    db;
    dbPath;
    constructor(db, dbPath) {
        this.db = db;
        this.dbPath = dbPath;
    }
    /**
     * Performs an integrity check on the SQLite database.
     */
    async checkIntegrity() {
        try {
            const res = await this.db.get('PRAGMA integrity_check;');
            if (res && res.integrity_check === 'ok') {
                return { ok: true, message: 'Database integrity check passed' };
            }
            return { ok: false, message: `Integrity issue: ${res?.integrity_check || 'Unknown'}` };
        }
        catch (err) {
            return { ok: false, message: `Check failed: ${err.message}` };
        }
    }
    /**
     * Creates a backup copy of the current SQLite database to the specified target directory.
     */
    async createBackup(targetDirectory) {
        if (!node_fs_1.default.existsSync(targetDirectory)) {
            node_fs_1.default.mkdirSync(targetDirectory, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `kumon_siso_backup_${timestamp}.sqlite`;
        const backupFilePath = node_path_1.default.join(targetDirectory, backupFileName);
        // Perform safe SQLite VACUUM INTO backup
        await this.db.run(`VACUUM INTO '${backupFilePath.replace(/'/g, "''")}';`);
        const fileBuffer = node_fs_1.default.readFileSync(backupFilePath);
        const checksum = (0, node_crypto_1.createHash)('sha256').update(fileBuffer).digest('hex');
        return {
            success: true,
            backupFilePath,
            checksum,
        };
    }
    /**
     * Export a complete center migration transfer package containing database, manifest, and checksum.
     */
    async exportTransferPackage(exportDir) {
        if (!node_fs_1.default.existsSync(exportDir)) {
            node_fs_1.default.mkdirSync(exportDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const packageDirName = `kumon_siso_migration_${timestamp}`;
        const packageDirPath = node_path_1.default.join(exportDir, packageDirName);
        node_fs_1.default.mkdirSync(packageDirPath, { recursive: true });
        const dbBackupPath = node_path_1.default.join(packageDirPath, 'database.sqlite');
        await this.db.run(`VACUUM INTO '${dbBackupPath.replace(/'/g, "''")}';`);
        const fileBuffer = node_fs_1.default.readFileSync(dbBackupPath);
        const checksum = (0, node_crypto_1.createHash)('sha256').update(fileBuffer).digest('hex');
        const manifest = {
            app: 'Kumon SISO Student Attendance & Pickup System',
            version: '1.0.0',
            exported_at: new Date().toISOString(),
            checksum,
        };
        node_fs_1.default.writeFileSync(node_path_1.default.join(packageDirPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
        return packageDirPath;
    }
    /**
     * Restores database from a verified transfer package path.
     */
    static async restoreFromPackage(packageDirPath, targetDbPath) {
        const manifestPath = node_path_1.default.join(packageDirPath, 'manifest.json');
        const dbSourcePath = node_path_1.default.join(packageDirPath, 'database.sqlite');
        if (!node_fs_1.default.existsSync(manifestPath) || !node_fs_1.default.existsSync(dbSourcePath)) {
            return { success: false, message: 'Invalid package layout. Missing manifest or database file.' };
        }
        const manifest = JSON.parse(node_fs_1.default.readFileSync(manifestPath, 'utf8'));
        const fileBuffer = node_fs_1.default.readFileSync(dbSourcePath);
        const calculatedChecksum = (0, node_crypto_1.createHash)('sha256').update(fileBuffer).digest('hex');
        if (calculatedChecksum !== manifest.checksum) {
            return { success: false, message: 'Checksum mismatch! Package may be corrupted or modified.' };
        }
        // Copy source DB to target path
        const targetDir = node_path_1.default.dirname(targetDbPath);
        if (!node_fs_1.default.existsSync(targetDir)) {
            node_fs_1.default.mkdirSync(targetDir, { recursive: true });
        }
        node_fs_1.default.copyFileSync(dbSourcePath, targetDbPath);
        return { success: true, message: 'Database successfully restored from package.' };
    }
}
exports.BackupService = BackupService;
