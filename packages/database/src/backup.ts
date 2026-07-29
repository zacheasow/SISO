import { Database } from './db.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class BackupService {
  constructor(private db: Database, private dbPath: string) {}

  /**
   * Performs an integrity check on the SQLite database.
   */
  async checkIntegrity(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await this.db.get<{ integrity_check: string }>('PRAGMA integrity_check;');
      if (res && res.integrity_check === 'ok') {
        return { ok: true, message: 'Database integrity check passed' };
      }
      return { ok: false, message: `Integrity issue: ${res?.integrity_check || 'Unknown'}` };
    } catch (err: any) {
      return { ok: false, message: `Check failed: ${err.message}` };
    }
  }

  /**
   * Creates a backup copy of the current SQLite database to the specified target directory.
   */
  async createBackup(targetDirectory: string): Promise<{ success: boolean; backupFilePath: string; checksum: string }> {
    if (!fs.existsSync(targetDirectory)) {
      fs.mkdirSync(targetDirectory, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `kumon_siso_backup_${timestamp}.sqlite`;
    const backupFilePath = path.join(targetDirectory, backupFileName);

    // Perform safe SQLite VACUUM INTO backup
    await this.db.run(`VACUUM INTO '${backupFilePath.replace(/'/g, "''")}';`);

    const fileBuffer = fs.readFileSync(backupFilePath);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    return {
      success: true,
      backupFilePath,
      checksum,
    };
  }

  /**
   * Export a complete center migration transfer package containing database, manifest, and checksum.
   */
  async exportTransferPackage(exportDir: string): Promise<string> {
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const packageDirName = `kumon_siso_migration_${timestamp}`;
    const packageDirPath = path.join(exportDir, packageDirName);
    fs.mkdirSync(packageDirPath, { recursive: true });

    const dbBackupPath = path.join(packageDirPath, 'database.sqlite');
    await this.db.run(`VACUUM INTO '${dbBackupPath.replace(/'/g, "''")}';`);

    const fileBuffer = fs.readFileSync(dbBackupPath);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    const manifest = {
      app: 'Kumon SISO Student Attendance & Pickup System',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      checksum,
    };

    fs.writeFileSync(path.join(packageDirPath, 'manifest.json'), JSON.stringify(manifest, null, 2));

    return packageDirPath;
  }

  /**
   * Restores database from a verified transfer package path.
   */
  static async restoreFromPackage(packageDirPath: string, targetDbPath: string): Promise<{ success: boolean; message: string }> {
    const manifestPath = path.join(packageDirPath, 'manifest.json');
    const dbSourcePath = path.join(packageDirPath, 'database.sqlite');

    if (!fs.existsSync(manifestPath) || !fs.existsSync(dbSourcePath)) {
      return { success: false, message: 'Invalid package layout. Missing manifest or database file.' };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const fileBuffer = fs.readFileSync(dbSourcePath);
    const calculatedChecksum = createHash('sha256').update(fileBuffer).digest('hex');

    if (calculatedChecksum !== manifest.checksum) {
      return { success: false, message: 'Checksum mismatch! Package may be corrupted or modified.' };
    }

    // Copy source DB to target path
    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(dbSourcePath, targetDbPath);
    return { success: true, message: 'Database successfully restored from package.' };
  }
}
