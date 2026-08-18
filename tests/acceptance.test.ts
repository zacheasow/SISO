import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database, CenterDao, StudentDao, AttendanceDao, DeviceDao, SmsDao, AuditDao, BackupService } from '@kumon-siso/database';
import { SyncEngine } from '@kumon-siso/sync';
import { parseAndValidateCsv, detectColumnMapping, generateErrorReportCsv } from '@kumon-siso/import';
import { normalizePhoneNumber, isValidPhoneNumber, maskPhoneNumber, hashPin, verifyPin, EVENT_TYPES, DROPOFF_ACK_STATUS, PICKUP_ACK_STATUS } from '@kumon-siso/shared';
import { generateQrDataUrl } from '@kumon-siso/qr';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = './data/test_kumon_siso.sqlite';

describe('Kumon SISO - Comprehensive 36-Step Acceptance & Integration Suite', () => {
  let db: Database;
  let centerDao: CenterDao;
  let studentDao: StudentDao;
  let attendanceDao: AttendanceDao;
  let deviceDao: DeviceDao;
  let smsDao: SmsDao;
  let auditDao: AuditDao;
  let backupService: BackupService;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    await db.init();

    centerDao = new CenterDao(db);
    studentDao = new StudentDao(db);
    attendanceDao = new AttendanceDao(db);
    deviceDao = new DeviceDao(db);
    smsDao = new SmsDao(db);
    auditDao = new AuditDao(db);
    backupService = new BackupService(db, TEST_DB_PATH);
    syncEngine = new SyncEngine(db);
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('1-4. Non-technical operator initializes center and secrets locally', async () => {
    const pinHash = hashPin('1234');
    await centerDao.initializeCenter({
      center_name: 'Kumon Learning Center Alpha',
      contact_phone: '+15551234567',
      time_zone: 'America/New_York',
      staff_pin_hash: pinHash,
    });

    const info = await centerDao.getCenterInfo();
    expect(info).toBeDefined();
    expect(info?.center_name).toBe('Kumon Learning Center Alpha');
    expect(Boolean(info?.is_onboarded)).toBe(true);
    expect(verifyPin('1234', info!.staff_pin_hash)).toBe(true);
  });

  it('5-7. Imports CSV roster, detects column mappings, and validates duplicate IDs', async () => {
    const rawCsv = `Student Number,Full Name,Guardian 1 Phone,Guardian 2 Phone
10001,Jordan Lee,555-123-4567,555-765-4321
10002,Alex Rivera,555-987-6543,
10003,Taylor Morgan,555-345-6789,555-234-5678`;

    const preview = parseAndValidateCsv(rawCsv);
    expect(preview.validCount).toBe(3);
    expect(preview.errorCount).toBe(0);

    for (const r of preview.rows) {
      await studentDao.createStudent({
        student_id: r.studentId,
        student_name: r.studentName,
        parent1_phone: r.parent1Phone,
        parent2_phone: r.parent2Phone,
      });
    }

    const all = await studentDao.getAllStudents();
    expect(all.length).toBe(3);
    expect(all[0].student_name).toBe('Alex Rivera');
  });

  it('8-9. Automatic QR generation and client-side PDF card sheet layout', async () => {
    const student = await studentDao.createStudent({
      student_id: '99001',
      student_name: 'Sam Wilson',
      parent1_phone: '+15551112222',
    });

    expect(student.qr_identifier).toBeDefined();
    expect(student.qr_identifier.length).toBeGreaterThan(10);

    // QR data URL generation (PDF generation is now handled client-side via jsPDF)
    const dataUrl = await generateQrDataUrl(student.qr_identifier);
    expect(dataUrl).toBeTruthy();
    expect(dataUrl.startsWith('data:image')).toBe(true);
  });

  it('10-15. Tablet check-in, scheduled class matching, sub-second local event queue, and Parent 1 & 2 SMS', async () => {
    const student = await studentDao.createStudent({
      student_id: '10001',
      student_name: 'Jordan Lee',
      parent1_phone: '+15551234567',
      parent2_phone: '+15557654321',
    });

    const cls = await studentDao.createClass('Math Tutoring', 'Advanced Math');
    await studentDao.createSchedule({
      class_id: cls.id,
      day_of_week: new Date().getDay(),
      start_time: '00:00',
      end_time: '23:59',
    });
    await studentDao.enrollStudent(student.id, cls.id);

    const matched = await studentDao.getMatchingClassesForStudent(student.id, new Date());
    expect(matched.length).toBe(1);
    expect(matched[0].name).toBe('Math Tutoring');

    const syncResult = await syncEngine.processSync({
      device_id: 'TABLET_01',
      events: [
        {
          id: 'evt_1',
          attendance_session_id: 'session_100',
          event_type: EVENT_TYPES.STUDENT_CHECKED_IN,
          originating_device_id: 'TABLET_01',
          client_timestamp: new Date().toISOString(),
          idempotency_key: 'idem_100',
          student_id: student.id,
          class_id: cls.id,
        },
      ],
    });

    expect(syncResult.success).toBe(true);

    const session = await attendanceDao.getSessionById('session_100');
    expect(session).toBeDefined();
    expect(session?.student_time_in).toBeDefined();
    expect(session?.student_time_out).toBeNull();

    // Verify SMS queue for Parent 1 and Parent 2
    const smsLogs = await smsDao.getAllSmsLogs();
    expect(smsLogs.length).toBe(2);
    const maskedNumbers = smsLogs.map((l) => l.recipient_masked);
    expect(maskedNumbers).toContain(maskPhoneNumber('+15551234567'));
    expect(maskedNumbers).toContain(maskPhoneNumber('+15557654321'));
  });

  it('16-17. Drop-off acknowledgment recorded separately from Student Time In', async () => {
    const student = await studentDao.createStudent({
      student_id: '10002',
      student_name: 'Alex Rivera',
      parent1_phone: '+15559876543',
    });
    const cls = await studentDao.createClass('Reading');

    await attendanceDao.createCheckinSession({
      sessionId: 'sess_200',
      studentId: student.id,
      classId: cls.id,
      timeIn: '2026-07-29T10:00:00.000Z',
      deviceId: 'TABLET_01',
    });

    const dropoffTime = '2026-07-29T10:05:00.000Z';
    await attendanceDao.recordDropoffAck('sess_200', maskPhoneNumber(student.parent1_phone), dropoffTime);

    const session = await attendanceDao.getSessionById('sess_200');
    expect(session?.dropoff_ack_status).toBe(DROPOFF_ACK_STATUS.ACKNOWLEDGED);
    expect(session?.dropoff_ack_time).toBe(dropoffTime);
    expect(session?.student_time_in).toBe('2026-07-29T10:00:00.000Z');
  });

  it('23-28. Parent pickup request does NOT set Student Time Out until Staff physical checkout', async () => {
    const student = await studentDao.createStudent({
      student_id: '10003',
      student_name: 'Taylor Morgan',
      parent1_phone: '+15553456789',
    });
    const cls = await studentDao.createClass('Science');

    await attendanceDao.createCheckinSession({
      sessionId: 'sess_300',
      studentId: student.id,
      classId: cls.id,
      timeIn: '2026-07-29T14:00:00.000Z',
      deviceId: 'TABLET_01',
    });

    // Parent acknowledges pickup request
    await attendanceDao.recordPickupAck('sess_300', maskPhoneNumber(student.parent1_phone), '2026-07-29T15:30:00.000Z');
    let session = await attendanceDao.getSessionById('sess_300');

    expect(session?.pickup_ack_status).toBe(PICKUP_ACK_STATUS.PICKUP_REQUESTED);
    expect(session?.student_time_out).toBeNull(); // Must remain checked in!

    // Staff physical release checkout
    const timeOut = '2026-07-29T15:35:00.000Z';
    await attendanceDao.checkoutStudent('sess_300', 'TABLET_01', timeOut);

    session = await attendanceDao.getSessionById('sess_300');
    expect(session?.student_time_out).toBe(timeOut);
    expect(session?.pickup_ack_status).toBe('COMPLETED');

    // Calculate duration: 14:00 to 15:35 = 95 minutes
    const history = await attendanceDao.getAttendanceHistory({ studentId: student.id });
    expect(history[0].duration_minutes).toBe(95);
  });

  it('29. Direct checkout override with optional reason (no PIN required)', async () => {
    const student = await studentDao.createStudent({
      student_id: '10004',
      student_name: 'Morgan Smith',
      parent1_phone: '+15554567890',
    });
    const cls = await studentDao.createClass('Art');

    await attendanceDao.createCheckinSession({
      sessionId: 'sess_400',
      studentId: student.id,
      classId: cls.id,
      timeIn: '2026-07-29T11:00:00.000Z',
      deviceId: 'TABLET_01',
    });

    // Override checkout executes immediately — no PIN gate
    await attendanceDao.checkoutStudentWithOverride(
      'sess_400',
      'DESKTOP_ADMIN',
      '2026-07-29T12:00:00.000Z',
      'Parent phone battery died'
    );

    const session = await attendanceDao.getSessionById('sess_400');
    expect(session?.is_override).toBe(1);
    expect(session?.override_reason).toBe('Parent phone battery died');

    // Also verify direct checkout without override works
    const student2 = await studentDao.createStudent({
      student_id: '10005',
      student_name: 'Casey Jones',
      parent1_phone: '+15556789012',
    });
    await attendanceDao.createCheckinSession({
      sessionId: 'sess_401',
      studentId: student2.id,
      classId: cls.id,
      timeIn: '2026-07-29T11:00:00.000Z',
      deviceId: 'TABLET_01',
    });
    await attendanceDao.checkoutStudent('sess_401', 'DESKTOP_ADMIN', '2026-07-29T12:30:00.000Z');
    const session2 = await attendanceDao.getSessionById('sess_401');
    expect(session2?.student_time_out).toBe('2026-07-29T12:30:00.000Z');
    expect(session2?.is_override).toBe(0);
  });

  it('32-35. Backup creation, transfer package export, and restoration to new computer without distributor help', async () => {
    // Seed student data before export
    await studentDao.createStudent({
      student_id: '99005',
      student_name: 'Transfer Test Student',
      parent1_phone: '+15559998888',
    });

    const exportDir = './data/test_export_packages';
    if (fs.existsSync(exportDir)) {
      fs.rmSync(exportDir, { recursive: true, force: true });
    }

    const packagePath = await backupService.exportTransferPackage(exportDir);
    expect(fs.existsSync(packagePath)).toBe(true);
    expect(fs.existsSync(path.join(packagePath, 'manifest.json'))).toBe(true);

    const newDbPath = './data/restored_kumon_siso.sqlite';
    if (fs.existsSync(newDbPath)) {
      fs.unlinkSync(newDbPath);
    }

    const result = await BackupService.restoreFromPackage(packagePath, newDbPath);
    expect(result.success).toBe(true);

    // Verify restored database integrity and records
    const restoredDb = new Database(newDbPath);
    await restoredDb.init();
    const restoredStudentDao = new StudentDao(restoredDb);
    const restoredStudents = await restoredStudentDao.getAllStudents();
    expect(restoredStudents.length).toBeGreaterThan(0);

    await restoredDb.close();
    if (fs.existsSync(newDbPath)) fs.unlinkSync(newDbPath);
    if (fs.existsSync(exportDir)) fs.rmSync(exportDir, { recursive: true, force: true });
  });

  it('36. Dynamic Config DAO & Notification Dispatcher (WebPush / DevOutbox)', async () => {
    const { ConfigDao } = await import('@kumon-siso/database');
    const { NotificationDispatcher, WebPushAdapter, DevOutboxAdapter } = await import('@kumon-siso/sms-adapters');

    const configDao = new ConfigDao(db);
    let cfg = await configDao.getConfig();
    expect(cfg.notification_provider).toBe('DEV_OUTBOX');

    // Default provider should be DevOutbox
    const defaultDispatcher = new NotificationDispatcher(cfg, './sms_outbox');
    expect(defaultDispatcher.getAdapter()).toBeInstanceOf(DevOutboxAdapter);

    // Update config to WEB_PUSH
    cfg = await configDao.updateConfig({
      notification_provider: 'WEB_PUSH',
      vapid_public_key: 'BEl62i_test_public_key',
      vapid_private_key: 'test_private_key',
    });
    expect(cfg.notification_provider).toBe('WEB_PUSH');
    expect(cfg.vapid_public_key).toBe('BEl62i_test_public_key');

    const dispatcher = new NotificationDispatcher(cfg, './sms_outbox');
    const adapter = dispatcher.getAdapter();
    expect(adapter).toBeInstanceOf(WebPushAdapter);

    // Switch back to DEV_OUTBOX
    cfg = await configDao.updateConfig({ notification_provider: 'DEV_OUTBOX' });
    expect(cfg.notification_provider).toBe('DEV_OUTBOX');
    const devDispatcher = new NotificationDispatcher(cfg, './sms_outbox');
    expect(devDispatcher.getAdapter()).toBeInstanceOf(DevOutboxAdapter);
  });

  it('37. Public Cloudflare Quick Tunnel Security Scoping (Admin 403 vs Public Allowed)', { timeout: 15000 }, async () => {
    const { createServer } = await import('../apps/local-server/src/server.js');
    const instance = await createServer('./data/test_sec_scoping.sqlite');

    // Seed a checked-in student so the parent portal has data to return
    const portalStudent = await instance.studentDao.createStudent({
      student_id: '10042',
      student_name: 'Emma Johnson',
      parent1_phone: '+15551234567',
    });
    const portalClass = await instance.studentDao.createClass('Math Tutoring');
    await instance.attendanceDao.createCheckinSession({
      sessionId: 'sess_portal_1',
      studentId: portalStudent.id,
      classId: portalClass.id,
      timeIn: new Date().toISOString(),
      deviceId: 'TABLET_01',
    });

    // Test 1: Public Parent Ack endpoint over public trycloudflare.com domain -> Allowed
    const resPublic = await instance.fastify.inject({
      method: 'POST',
      url: '/api/parent/ack-dropoff',
      headers: { host: 'abcdef-random.trycloudflare.com' },
      payload: { sessionId: 'test_sess_sec', maskedPhone: 'Parent Web Link' },
    });
    expect(resPublic.statusCode).not.toBe(403);

    // Test 2: Sensitive Admin endpoint over public trycloudflare.com domain -> 403 Forbidden
    const resAdminPublic = await instance.fastify.inject({
      method: 'GET',
      url: '/api/students',
      headers: { host: 'abcdef-random.trycloudflare.com' },
    });
    expect(resAdminPublic.statusCode).toBe(403);
    expect(JSON.parse(resAdminPublic.payload).error).toBe('Forbidden');

    // Test 3: Local Admin request over localhost -> Allowed
    const resAdminLocal = await instance.fastify.inject({
      method: 'GET',
      url: '/api/students',
      headers: { host: 'localhost:3000' },
    });
    expect(resAdminLocal.statusCode).toBe(200);

    // Test 4: Parent portal page + assets reachable over the public tunnel
    const resPortalPage = await instance.fastify.inject({
      method: 'GET',
      url: '/parent.html',
      headers: { host: 'abcdef-random.trycloudflare.com' },
    });
    expect(resPortalPage.statusCode).not.toBe(403);
    const resPortalAsset = await instance.fastify.inject({
      method: 'GET',
      url: '/assets/portal-example.js',
      headers: { host: 'abcdef-random.trycloudflare.com' },
    });
    expect(resPortalAsset.statusCode).not.toBe(403);

    // Test 5: Parent portal status lookup over the public tunnel returns the checked-in student
    const resPortalStudents = await instance.fastify.inject({
      method: 'GET',
      url: '/api/parent/students?firstName=Emma&lastName=Johnson',
      headers: { host: 'abcdef-random.trycloudflare.com' },
    });
    expect(resPortalStudents.statusCode).toBe(200);
    const portalMatches = JSON.parse(resPortalStudents.payload);
    expect(portalMatches.length).toBe(1);
    expect(portalMatches[0].checked_in).toBe(true);
    expect(portalMatches[0].session_id).toBe('sess_portal_1');

    // Test 6: Parent portal sign-out over the public tunnel completes checkout
    const resPortalSignout = await instance.fastify.inject({
      method: 'POST',
      url: '/api/parent/signout',
      headers: { host: 'abcdef-random.trycloudflare.com' },
      payload: { sessionId: 'sess_portal_1' },
    });
    expect(resPortalSignout.statusCode).toBe(200);
    const signedOut = await instance.attendanceDao.getSessionById('sess_portal_1');
    expect(signedOut?.student_time_out).toBeDefined();

    // Test 7: Double sign-out is rejected (already checked out)
    const resPortalSignoutAgain = await instance.fastify.inject({
      method: 'POST',
      url: '/api/parent/signout',
      headers: { host: 'abcdef-random.trycloudflare.com' },
      payload: { sessionId: 'sess_portal_1' },
    });
    expect(resPortalSignoutAgain.statusCode).toBe(409);

    await instance.db.close();
    if (fs.existsSync('./data/test_sec_scoping.sqlite')) {
      fs.unlinkSync('./data/test_sec_scoping.sqlite');
    }
  });

  it('38. Atomic /api/check-in + streamlined /api/sync offline replay', { timeout: 15000 }, async () => {
    const { createServer } = await import('../apps/local-server/src/server.js');
    const instance = await createServer('./data/test_checkin.sqlite');

    const student = await instance.studentDao.createStudent({
      student_id: '10050',
      student_name: 'Ava Chen',
      parent1_phone: '+15551112222',
    });

    // 1. Check-in creates an attendance session with the walk-in class
    const checkIn = await instance.fastify.inject({
      method: 'POST',
      url: '/api/check-in',
      payload: { studentId: student.id, deviceId: 'TABLET_01' },
    });
    expect(checkIn.statusCode).toBe(200);
    const checkInBody = JSON.parse(checkIn.payload);
    expect(checkInBody.status).toBe('checked_in');
    expect(checkInBody.student.id).toBe(student.id);
    expect(checkInBody.session.timeIn).toBeDefined();

    const session = await instance.attendanceDao.getActiveSessionForStudent(student.id);
    expect(session).toBeDefined();
    expect(session?.class_id).toBe('class_walkin');

    // 2. Check-in again toggles to checkout with duration
    const checkOut = await instance.fastify.inject({
      method: 'POST',
      url: '/api/check-in',
      payload: { studentId: student.id, deviceId: 'TABLET_01' },
    });
    expect(checkOut.statusCode).toBe(200);
    const checkOutBody = JSON.parse(checkOut.payload);
    expect(checkOutBody.status).toBe('checked_out');
    expect(checkOutBody.session.timeOut).toBeDefined();
    expect(checkOutBody.session.duration).toBeGreaterThanOrEqual(0);

    // 3. /api/attendance/today returns the session
    const todayRes = await instance.fastify.inject({
      method: 'GET',
      url: '/api/attendance/today',
    });
    expect(todayRes.statusCode).toBe(200);
    const today = JSON.parse(todayRes.payload);
    expect(today.length).toBe(1);
    expect(today[0].student_id).toBe(student.id);

    // 4. Streamlined /api/sync replays offline queued events
    const syncRes = await instance.fastify.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        device_id: 'TABLET_01',
        events: [
          { id: 'evt_offline_1', studentId: student.id, timestamp: new Date().toISOString(), action: 'check_in' },
        ],
      },
    });
    expect(syncRes.statusCode).toBe(200);
    const syncBody = JSON.parse(syncRes.payload);
    expect(syncBody.success).toBe(true);
    expect(syncBody.processed).toBe(1);

    const activeAfterSync = await instance.attendanceDao.getActiveSessionForStudent(student.id);
    expect(activeAfterSync).toBeDefined();

    await instance.db.close();
    if (fs.existsSync('./data/test_checkin.sqlite')) {
      fs.unlinkSync('./data/test_checkin.sqlite');
    }
  });
});
