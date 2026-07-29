"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsDao = void 0;
const shared_1 = require("@kumon-siso/shared");
const node_crypto_1 = require("node:crypto");
class SmsDao {
    db;
    constructor(db) {
        this.db = db;
    }
    async queueSms(data) {
        const id = (0, node_crypto_1.randomUUID)();
        await this.db.run(`INSERT INTO sms_queue (id, attendance_session_id, recipient_phone, recipient_masked, parent_index, message_body, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, data.attendanceSessionId, data.recipientPhone, data.recipientMasked, data.parentIndex, data.messageBody, shared_1.SMS_STATUS.PENDING]);
        return (await this.db.get('SELECT * FROM sms_queue WHERE id = ?', [id]));
    }
    async getPendingMessages(limit = 50) {
        return this.db.all(`SELECT * FROM sms_queue WHERE status IN ('PENDING', 'FAILED') AND retry_count < 5 ORDER BY created_at ASC LIMIT ?`, [limit]);
    }
    async updateStatus(id, status, errorMsg) {
        await this.db.run(`UPDATE sms_queue SET
        status = ?,
        retry_count = retry_count + 1,
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [status, errorMsg || null, id]);
    }
    async getAllSmsLogs(limit = 100) {
        return this.db.all('SELECT * FROM sms_queue ORDER BY created_at DESC LIMIT ?', [limit]);
    }
}
exports.SmsDao = SmsDao;
