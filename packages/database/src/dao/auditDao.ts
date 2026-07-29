import { Database } from '../db.js';
import { AuditLogItem } from '@kumon-siso/shared';
import { randomUUID } from 'node:crypto';

export class AuditDao {
  constructor(private db: Database) {}

  async log(action: string, actorDeviceId?: string, details?: any): Promise<void> {
    const id = randomUUID();
    const detailsStr = details ? JSON.stringify(details) : null;
    await this.db.run(
      'INSERT INTO audit_log (id, action, actor_device_id, details) VALUES (?, ?, ?, ?)',
      [id, action, actorDeviceId || null, detailsStr]
    );
  }

  async getRecentLogs(limit = 200): Promise<AuditLogItem[]> {
    return this.db.all<AuditLogItem>('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?', [limit]);
  }
}
