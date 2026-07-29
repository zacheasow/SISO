import { SyncPayload, SyncResponse } from '@kumon-siso/shared';
import { Database } from '@kumon-siso/database';
export declare class SyncEngine {
    private parentRelayBaseUrl;
    private attendanceDao;
    private studentDao;
    private smsDao;
    private auditDao;
    constructor(db: Database, parentRelayBaseUrl?: string);
    processSync(payload: SyncPayload): Promise<SyncResponse>;
    private queueParentAckSms;
}
