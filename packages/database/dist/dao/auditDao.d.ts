import { Database } from '../db.js';
import { AuditLogItem } from '@kumon-siso/shared';
export declare class AuditDao {
    private db;
    constructor(db: Database);
    log(action: string, actorDeviceId?: string, details?: any): Promise<void>;
    getRecentLogs(limit?: number): Promise<AuditLogItem[]>;
}
