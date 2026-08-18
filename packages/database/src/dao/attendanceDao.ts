import { Database } from '../db.js';
import {
  AttendanceSession,
  AttendanceEvent,
  EventType,
  DropoffAckStatus,
  PickupAckStatus,
  DROPOFF_ACK_STATUS,
  PICKUP_ACK_STATUS,
  EVENT_TYPES,
} from '@kumon-siso/shared';
import { randomUUID } from 'node:crypto';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export class AttendanceDao {
  constructor(private db: Database) {}

  async getSessionById(id: string): Promise<AttendanceSession | undefined> {
    return this.db.get<AttendanceSession>(
      `SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.id = ?`,
      [id]
    );
  }

  async getActiveSessionForStudent(studentId: string): Promise<AttendanceSession | undefined> {
    return this.db.get<AttendanceSession>(
      `SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_id = ? AND a.student_time_out IS NULL`,
      [studentId]
    );
  }

  async getCurrentlyCheckedInStudents(): Promise<Array<AttendanceSession & { duration_minutes: number | null; duration_text: string }>> {
    const rows = await this.db.all<AttendanceSession>(
      `SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_time_out IS NULL
       ORDER BY a.student_time_in DESC`
    );
    const now = Date.now();
    return rows.map((r) => {
      const diffMs = now - new Date(r.student_time_in).getTime();
      const duration_minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      return { ...r, duration_minutes, duration_text: formatDuration(duration_minutes) };
    });
  }

  async getPendingPickupRequests(): Promise<AttendanceSession[]> {
    return this.db.all<AttendanceSession>(
      `SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
       FROM attendance_sessions a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_time_out IS NULL AND a.pickup_ack_status = 'PICKUP_REQUESTED'
       ORDER BY a.pickup_ack_time DESC`
    );
  }

  async createCheckinSession(data: {
    sessionId?: string;
    studentId: string;
    classId: string;
    timeIn: string;
    deviceId: string;
    isOverride?: boolean;
    overrideReason?: string;
  }): Promise<AttendanceSession> {
    const id = data.sessionId || randomUUID();
    await this.db.run(
      `INSERT INTO attendance_sessions (
        id, student_id, class_id, student_time_in, checkin_device_id,
        dropoff_ack_status, pickup_ack_status, is_override, override_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.studentId,
        data.classId,
        data.timeIn,
        data.deviceId,
        DROPOFF_ACK_STATUS.NOT_SENT,
        PICKUP_ACK_STATUS.NOT_REQUESTED,
        data.isOverride ? 1 : 0,
        data.overrideReason || null,
      ]
    );

    const session = await this.getSessionById(id);
    return session!;
  }

  async recordDropoffAck(sessionId: string, maskedPhoneRef: string, timestamp: string): Promise<void> {
    await this.db.run(
      `UPDATE attendance_sessions SET
        dropoff_ack_status = ?,
        dropoff_ack_time = ?,
        dropoff_ack_dest_phone_ref = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [DROPOFF_ACK_STATUS.ACKNOWLEDGED, timestamp, maskedPhoneRef, sessionId]
    );
  }

  async recordDropoffOverride(sessionId: string, reason: string): Promise<void> {
    await this.db.run(
      `UPDATE attendance_sessions SET
        dropoff_ack_status = ?,
        is_override = 1,
        override_type = 'DROPOFF_OVERRIDE',
        override_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [DROPOFF_ACK_STATUS.STAFF_OVERRIDE, reason, sessionId]
    );
  }

  async recordPickupAck(sessionId: string, maskedPhoneRef: string, timestamp: string): Promise<void> {
    await this.db.run(
      `UPDATE attendance_sessions SET
        pickup_ack_status = ?,
        pickup_ack_time = ?,
        pickup_ack_dest_phone_ref = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [PICKUP_ACK_STATUS.PICKUP_REQUESTED, timestamp, maskedPhoneRef, sessionId]
    );
  }

  async checkoutStudent(sessionId: string, deviceId: string, timestamp: string): Promise<void> {
    await this.db.run(
      `UPDATE attendance_sessions SET
        student_time_out = ?,
        checkout_device_id = ?,
        pickup_ack_status = CASE WHEN pickup_ack_status = 'PICKUP_REQUESTED' THEN 'COMPLETED' ELSE pickup_ack_status END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [timestamp, deviceId, sessionId]
    );
  }

  async checkoutStudentWithOverride(sessionId: string, deviceId: string, timestamp: string, reason: string): Promise<void> {
    await this.db.run(
      `UPDATE attendance_sessions SET
        student_time_out = ?,
        checkout_device_id = ?,
        pickup_ack_status = ?,
        is_override = 1,
        override_type = 'PICKUP_OVERRIDE',
        override_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [timestamp, deviceId, PICKUP_ACK_STATUS.STAFF_OVERRIDE, reason, sessionId]
    );
  }

  // Event Log methods
  async logEvent(data: {
    eventId?: string;
    sessionId: string;
    eventType: EventType;
    originatingDeviceId: string;
    clientTimestamp: string;
    idempotencyKey: string;
    isOverride?: boolean;
    overrideReason?: string;
    metadata?: any;
  }): Promise<void> {
    const id = data.eventId || randomUUID();
    const metaStr = data.metadata ? JSON.stringify(data.metadata) : null;
    await this.db.run(
      `INSERT OR IGNORE INTO attendance_events (
        id, attendance_session_id, event_type, originating_device_id,
        client_timestamp, idempotency_key, is_override, override_reason, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.sessionId,
        data.eventType,
        data.originatingDeviceId,
        data.clientTimestamp,
        data.idempotencyKey,
        data.isOverride ? 1 : 0,
        data.overrideReason || null,
        metaStr,
      ]
    );
  }

  async hasEventWithIdempotencyKey(key: string): Promise<boolean> {
    const row = await this.db.get('SELECT id FROM attendance_events WHERE idempotency_key = ?', [key]);
    return !!row;
  }

  // Attendance History & Reports (2-year retention query support)
  async getAttendanceHistory(filters: {
    startDate?: string;
    endDate?: string;
    studentId?: string;
    classId?: string;
    missingDropoffAck?: boolean;
    missingPickupAck?: boolean;
    missingCheckout?: boolean;
    overridesOnly?: boolean;
  }): Promise<Array<AttendanceSession & { duration_minutes: number | null; duration_text: string }>> {
    let sql = `
      SELECT a.*, s.student_name, s.student_id as student_number, c.name as class_name
      FROM attendance_sessions a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = a.class_id
      WHERE 1=1
    `;
    const params: any[] = [];

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

    const rows = await this.db.all<AttendanceSession>(sql, params);

    return rows.map((r) => {
      let duration_minutes: number | null = null;
      if (r.student_time_in && r.student_time_out) {
        const diffMs = new Date(r.student_time_out).getTime() - new Date(r.student_time_in).getTime();
        duration_minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      }
      const duration_text = duration_minutes !== null ? formatDuration(duration_minutes) : 'In Progress';
      return {
        ...r,
        duration_minutes,
        duration_text,
      };
    });
  }

  async getAttendanceToday(): Promise<Array<AttendanceSession & { duration_minutes: number | null; duration_text: string }>> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.getAttendanceHistory({ startDate: startOfDay.toISOString(), endDate: endOfDay.toISOString() });
  }
}
