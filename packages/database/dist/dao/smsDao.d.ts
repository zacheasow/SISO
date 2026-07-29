import { Database } from '../db.js';
import { SmsRecord, SmsStatus } from '@kumon-siso/shared';
export declare class SmsDao {
    private db;
    constructor(db: Database);
    queueSms(data: {
        attendanceSessionId: string;
        recipientPhone: string;
        recipientMasked: string;
        parentIndex: number;
        messageBody: string;
    }): Promise<SmsRecord>;
    getPendingMessages(limit?: number): Promise<SmsRecord[]>;
    updateStatus(id: string, status: SmsStatus, errorMsg?: string): Promise<void>;
    getAllSmsLogs(limit?: number): Promise<SmsRecord[]>;
}
