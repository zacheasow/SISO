import {
  SyncPayload,
  SyncResponse,
  EVENT_TYPES,
  maskPhoneNumber,
  generateSecureToken,
  hashToken,
} from '@kumon-siso/shared';
import { AttendanceDao, StudentDao, SmsDao, AuditDao, Database } from '@kumon-siso/database';

export class SyncEngine {
  private attendanceDao: AttendanceDao;
  private studentDao: StudentDao;
  private smsDao: SmsDao;
  private auditDao: AuditDao;

  constructor(db: Database, private parentRelayBaseUrl = 'http://localhost:3000') {
    this.attendanceDao = new AttendanceDao(db);
    this.studentDao = new StudentDao(db);
    this.smsDao = new SmsDao(db);
    this.auditDao = new AuditDao(db);
  }

  async processSync(payload: SyncPayload): Promise<SyncResponse> {
    const processedEventIds: string[] = [];
    const errors: Array<{ event_id: string; error: string }> = [];

    for (const evt of payload.events) {
      try {
        // Idempotency check: Skip if idempotency key already processed
        const exists = await this.attendanceDao.hasEventWithIdempotencyKey(evt.idempotency_key);
        if (exists) {
          processedEventIds.push(evt.id);
          continue;
        }

        switch (evt.event_type) {
          case EVENT_TYPES.STUDENT_CHECKED_IN: {
            if (!evt.student_id || !evt.class_id) {
              errors.push({ event_id: evt.id, error: 'Missing student_id or class_id' });
              continue;
            }

            // Check if active session already exists
            const existingActive = await this.attendanceDao.getActiveSessionForStudent(evt.student_id);
            let sessionId = evt.attendance_session_id;

            if (existingActive) {
              sessionId = existingActive.id;
            } else {
              const newSession = await this.attendanceDao.createCheckinSession({
                sessionId: evt.attendance_session_id,
                studentId: evt.student_id,
                classId: evt.class_id,
                timeIn: evt.client_timestamp,
                deviceId: evt.originating_device_id,
                isOverride: evt.is_override,
                overrideReason: evt.override_reason,
              });
              sessionId = newSession.id;

              // Queue SMS for Parent 1 and Parent 2 if distinct
              const student = await this.studentDao.getStudentById(evt.student_id);
              if (student) {
                await this.queueParentAckSms(sessionId, student, evt.client_timestamp);
              }
            }

            await this.attendanceDao.logEvent({
              eventId: evt.id,
              sessionId,
              eventType: EVENT_TYPES.STUDENT_CHECKED_IN,
              originatingDeviceId: evt.originating_device_id,
              clientTimestamp: evt.client_timestamp,
              idempotencyKey: evt.idempotency_key,
              isOverride: evt.is_override,
              overrideReason: evt.override_reason,
              metadata: evt.metadata,
            });
            break;
          }

          case EVENT_TYPES.STUDENT_CHECKED_OUT: {
            await this.attendanceDao.checkoutStudent(
              evt.attendance_session_id,
              evt.originating_device_id,
              evt.client_timestamp
            );
            await this.attendanceDao.logEvent({
              eventId: evt.id,
              sessionId: evt.attendance_session_id,
              eventType: EVENT_TYPES.STUDENT_CHECKED_OUT,
              originatingDeviceId: evt.originating_device_id,
              clientTimestamp: evt.client_timestamp,
              idempotencyKey: evt.idempotency_key,
              isOverride: evt.is_override,
              overrideReason: evt.override_reason,
            });
            break;
          }

          case EVENT_TYPES.PICKUP_OVERRIDE: {
            await this.attendanceDao.checkoutStudentWithOverride(
              evt.attendance_session_id,
              evt.originating_device_id,
              evt.client_timestamp,
              evt.override_reason || 'Staff Pickup Override'
            );
            await this.attendanceDao.logEvent({
              eventId: evt.id,
              sessionId: evt.attendance_session_id,
              eventType: EVENT_TYPES.PICKUP_OVERRIDE,
              originatingDeviceId: evt.originating_device_id,
              clientTimestamp: evt.client_timestamp,
              idempotencyKey: evt.idempotency_key,
              isOverride: true,
              overrideReason: evt.override_reason,
            });
            break;
          }

          case EVENT_TYPES.DROPOFF_OVERRIDE: {
            await this.attendanceDao.recordDropoffOverride(
              evt.attendance_session_id,
              evt.override_reason || 'Staff Drop-off Override'
            );
            await this.attendanceDao.logEvent({
              eventId: evt.id,
              sessionId: evt.attendance_session_id,
              eventType: EVENT_TYPES.DROPOFF_OVERRIDE,
              originatingDeviceId: evt.originating_device_id,
              clientTimestamp: evt.client_timestamp,
              idempotencyKey: evt.idempotency_key,
              isOverride: true,
              overrideReason: evt.override_reason,
            });
            break;
          }

          default: {
            // Log generic event
            await this.attendanceDao.logEvent({
              eventId: evt.id,
              sessionId: evt.attendance_session_id,
              eventType: evt.event_type,
              originatingDeviceId: evt.originating_device_id,
              clientTimestamp: evt.client_timestamp,
              idempotencyKey: evt.idempotency_key,
              metadata: evt.metadata,
            });
            break;
          }
        }

        processedEventIds.push(evt.id);
      } catch (err: any) {
        errors.push({ event_id: evt.id, error: err.message || 'Processing error' });
      }
    }

    await this.auditDao.log('DEVICE_SYNC', payload.device_id, {
      total: payload.events.length,
      processed: processedEventIds.length,
      errorsCount: errors.length,
    });

    return {
      success: errors.length === 0,
      processed_event_ids: processedEventIds,
      acknowledged_count: processedEventIds.length,
      errors,
      server_timestamp: new Date().toISOString(),
    };
  }

  private async queueParentAckSms(sessionId: string, student: any, timeIn: string): Promise<void> {
    // Generate secure parent acknowledgment link token
    const rawToken = generateSecureToken(32);
    const ackUrl = `${this.parentRelayBaseUrl}/parent/ack/${rawToken}`;

    const formattedTime = new Date(timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgBody = `${student.student_name} checked in at ${formattedTime}. Please acknowledge drop-off & request pickup here: ${ackUrl}`;

    // Queue for Parent 1
    if (student.parent1_phone) {
      await this.smsDao.queueSms({
        attendanceSessionId: sessionId,
        recipientPhone: student.parent1_phone,
        recipientMasked: maskPhoneNumber(student.parent1_phone),
        parentIndex: 1,
        messageBody: msgBody,
      });
    }

    // Queue for Parent 2 if present and different
    if (student.parent2_phone && student.parent2_phone !== student.parent1_phone) {
      await this.smsDao.queueSms({
        attendanceSessionId: sessionId,
        recipientPhone: student.parent2_phone,
        recipientMasked: maskPhoneNumber(student.parent2_phone),
        parentIndex: 2,
        messageBody: msgBody,
      });
    }
  }
}
