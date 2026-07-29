import { Database } from '../db.js';
import { AttendanceSession, EventType } from '@kumon-siso/shared';
export declare class AttendanceDao {
    private db;
    constructor(db: Database);
    getSessionById(id: string): Promise<AttendanceSession | undefined>;
    getActiveSessionForStudent(studentId: string): Promise<AttendanceSession | undefined>;
    getCurrentlyCheckedInStudents(): Promise<AttendanceSession[]>;
    getPendingPickupRequests(): Promise<AttendanceSession[]>;
    createCheckinSession(data: {
        sessionId?: string;
        studentId: string;
        classId: string;
        timeIn: string;
        deviceId: string;
        isOverride?: boolean;
        overrideReason?: string;
    }): Promise<AttendanceSession>;
    recordDropoffAck(sessionId: string, maskedPhoneRef: string, timestamp: string): Promise<void>;
    recordDropoffOverride(sessionId: string, reason: string): Promise<void>;
    recordPickupAck(sessionId: string, maskedPhoneRef: string, timestamp: string): Promise<void>;
    checkoutStudent(sessionId: string, deviceId: string, timestamp: string): Promise<void>;
    checkoutStudentWithOverride(sessionId: string, deviceId: string, timestamp: string, reason: string): Promise<void>;
    logEvent(data: {
        eventId?: string;
        sessionId: string;
        eventType: EventType;
        originatingDeviceId: string;
        clientTimestamp: string;
        idempotencyKey: string;
        isOverride?: boolean;
        overrideReason?: string;
        metadata?: any;
    }): Promise<void>;
    hasEventWithIdempotencyKey(key: string): Promise<boolean>;
    getAttendanceHistory(filters: {
        startDate?: string;
        endDate?: string;
        studentId?: string;
        classId?: string;
        missingDropoffAck?: boolean;
        missingPickupAck?: boolean;
        missingCheckout?: boolean;
        overridesOnly?: boolean;
    }): Promise<Array<AttendanceSession & {
        duration_minutes: number | null;
    }>>;
}
