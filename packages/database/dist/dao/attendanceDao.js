"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceDao = void 0;
const shared_1 = require("@kumon-siso/shared");
const node_crypto_1 = require("node:crypto");
class AttendanceDao {
    db;
    constructor(db) {
        this.db = db;
    }
    async getSessionById(id) {
        return this.db.get(`SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.id = ?`, [id]);
    }
    async getActiveSessionForStudent(studentId) {
        return this.db.get(`SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_id = ? AND a.student_time_out IS NULL`, [studentId]);
    }
    async getCurrentlyCheckedInStudents() {
        return this.db.all(`SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_time_out IS NULL
       ORDER BY a.student_time_in DESC`);
    }
    async getPendingPickupRequests() {
        return this.db.all(`SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_time_out IS NULL AND a.pickup_ack_status = 'PICKUP_REQUESTED'
       ORDER BY a.pickup_ack_time DESC`);
    }
    async createCheckinSession(data) {
        const id = data.sessionId || (0, node_crypto_1.randomUUID)();
        await this.db.run(`INSERT INTO attendance_sessions (
        id, student_id, class_id, student_time_in, checkin_device_id,
        dropoff_ack_status, pickup_ack_status, is_override, override_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            data.studentId,
            data.classId,
            data.timeIn,
            data.deviceId,
            shared_1.DROPOFF_ACK_STATUS.NOT_SENT,
            shared_1.PICKUP_ACK_STATUS.NOT_REQUESTED,
            data.isOverride ? 1 : 0,
            data.overrideReason || null,
        ]);
        const session = await this.getSessionById(id);
        return session;
    }
    async recordDropoffAck(sessionId, maskedPhoneRef, timestamp) {
        await this.db.run(`UPDATE attendance_sessions SET
        dropoff_ack_status = ?,
        dropoff_ack_time = ?,
        dropoff_ack_dest_phone_ref = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [shared_1.DROPOFF_ACK_STATUS.ACKNOWLEDGED, timestamp, maskedPhoneRef, sessionId]);
    }
    async recordDropoffOverride(sessionId, reason) {
        await this.db.run(`UPDATE attendance_sessions SET
        dropoff_ack_status = ?,
        is_override = 1,
        override_type = 'DROPOFF_OVERRIDE',
        override_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [shared_1.DROPOFF_ACK_STATUS.STAFF_OVERRIDE, reason, sessionId]);
    }
    async recordPickupAck(sessionId, maskedPhoneRef, timestamp) {
        await this.db.run(`UPDATE attendance_sessions SET
        pickup_ack_status = ?,
        pickup_ack_time = ?,
        pickup_ack_dest_phone_ref = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [shared_1.PICKUP_ACK_STATUS.PICKUP_REQUESTED, timestamp, maskedPhoneRef, sessionId]);
    }
    async checkoutStudent(sessionId, deviceId, timestamp) {
        await this.db.run(`UPDATE attendance_sessions SET
        student_time_out = ?,
        checkout_device_id = ?,
        pickup_ack_status = CASE WHEN pickup_ack_status = 'PICKUP_REQUESTED' THEN 'COMPLETED' ELSE pickup_ack_status END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [timestamp, deviceId, sessionId]);
    }
    async checkoutStudentWithOverride(sessionId, deviceId, timestamp, reason) {
        await this.db.run(`UPDATE attendance_sessions SET
        student_time_out = ?,
        checkout_device_id = ?,
        pickup_ack_status = ?,
        is_override = 1,
        override_type = 'PICKUP_OVERRIDE',
        override_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [timestamp, deviceId, shared_1.PICKUP_ACK_STATUS.STAFF_OVERRIDE, reason, sessionId]);
    }
    // Event Log methods
    async logEvent(data) {
        const id = data.eventId || (0, node_crypto_1.randomUUID)();
        const metaStr = data.metadata ? JSON.stringify(data.metadata) : null;
        await this.db.run(`INSERT OR IGNORE INTO attendance_events (
        id, attendance_session_id, event_type, originating_device_id,
        client_timestamp, idempotency_key, is_override, override_reason, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            data.sessionId,
            data.eventType,
            data.originatingDeviceId,
            data.clientTimestamp,
            data.idempotencyKey,
            data.isOverride ? 1 : 0,
            data.overrideReason || null,
            metaStr,
        ]);
    }
    async hasEventWithIdempotencyKey(key) {
        const row = await this.db.get('SELECT id FROM attendance_events WHERE idempotency_key = ?', [key]);
        return !!row;
    }
    // Attendance History & Reports (2-year retention query support)
    async getAttendanceHistory(filters) {
        let sql = `
      SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
      FROM attendance_sessions a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = a.class_id
      WHERE 1=1
    `;
        const params = [];
        if (filters.startDate) {
            sql += ' AND a.student_time_in >= ?';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            sql += ' AND a.student_time_in <= ?';
            params.push(filters.endDate);
        }
        if (filters.studentId) {
            sql += ' AND a.student_id = ?';
            params.push(filters.studentId);
        }
        if (filters.classId) {
            sql += ' AND a.class_id = ?';
            params.push(filters.classId);
        }
        if (filters.missingDropoffAck) {
            sql += ` AND a.dropoff_ack_status != 'ACKNOWLEDGED'`;
        }
        if (filters.missingPickupAck) {
            sql += ` AND a.pickup_ack_status != 'PICKUP_REQUESTED' AND a.pickup_ack_status != 'COMPLETED'`;
        }
        if (filters.missingCheckout) {
            sql += ' AND a.student_time_out IS NULL';
        }
        if (filters.overridesOnly) {
            sql += ' AND a.is_override = 1';
        }
        sql += ' ORDER BY a.student_time_in DESC LIMIT 1000';
        const rows = await this.db.all(sql, params);
        return rows.map((r) => {
            let duration_minutes = null;
            if (r.student_time_in && r.student_time_out) {
                const diffMs = new Date(r.student_time_out).getTime() - new Date(r.student_time_in).getTime();
                duration_minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
            }
            return {
                ...r,
                duration_minutes,
            };
        });
    }
}
exports.AttendanceDao = AttendanceDao;
