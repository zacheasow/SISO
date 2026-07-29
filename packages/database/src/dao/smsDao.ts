import { Database } from '../db.js';
import { SmsRecord, SMS_STATUS, SmsStatus } from '@kumon-siso/shared';
import { randomUUID } from 'node:crypto';

export class SmsDao {
  constructor(private db: Database) {}

  async queueSms(data: {
    attendanceSessionId: string;
    recipientPhone: string;
    recipientMasked: string;
    parentIndex: number;
    messageBody: string;
  }): Promise<SmsRecord> {
    const id = randomUUID();
    await this.db.run(
      `INSERT INTO sms_queue (id, attendance_session_id, recipient_phone, recipient_masked, parent_index, message_body, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.attendanceSessionId, data.recipientPhone, data.recipientMasked, data.parentIndex, data.messageBody, SMS_STATUS.PENDING]
    );
    return (await this.db.get<SmsRecord>('SELECT * FROM sms_queue WHERE id = ?', [id]))!;
  }

  async getPendingMessages(limit = 50): Promise<SmsRecord[]> {
    return this.db.all<SmsRecord>(
      `SELECT * FROM sms_queue WHERE status IN ('PENDING', 'FAILED') AND retry_count < 5 ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
  }

  async updateStatus(id: string, status: SmsStatus, errorMsg?: string): Promise<void> {
    await this.db.run(
      `UPDATE sms_queue SET
        status = ?,
        retry_count = retry_count + 1,
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, errorMsg || null, id]
    );
  }

  async getAllSmsLogs(limit = 100): Promise<SmsRecord[]> {
    return this.db.all<SmsRecord>('SELECT * FROM sms_queue ORDER BY created_at DESC LIMIT ?', [limit]);
  }
}
