import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Database, CenterDao, StudentDao, AttendanceDao, DeviceDao, SmsDao, AuditDao, ConfigDao, BackupService } from '@kumon-siso/database';
import { SyncEngine } from '@kumon-siso/sync';
import { DevOutboxAdapter, NotificationDispatcher } from '@kumon-siso/sms-adapters';
import { hashPin, verifyPin } from '@kumon-siso/shared';
import { parseAndValidateCsv, generateErrorReportCsv } from '@kumon-siso/import';
import { TunnelManager } from './services/tunnelManager.js';
import Papa from 'papaparse';

/**
 * Pick the host's primary LAN address. Prefers private IPv4 ranges
 * (192.168.x.x, 10.x.x.x, 172.16-31.x.x) used by typical office/home Wi-Fi,
 * falling back to the first non-internal IPv4 address.
 */
function pickPrimaryLanIp(ips: string[]): string | null {
  const isPrivate = (ip: string) =>
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^192\.168\./.test(ip);
  return ips.find(isPrivate) || ips[0] || null;
}

/**
 * Sanitize a center name into a stable URL slug, e.g.
 * "Fremont Learning Center" -> "fremont-center".
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'center';
}

export async function createServer(dbPath = './data/sqlite.db') {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });

  const db = new Database(dbPath);
  await db.init();

  const centerDao = new CenterDao(db);
  const studentDao = new StudentDao(db);
  const attendanceDao = new AttendanceDao(db);
  const deviceDao = new DeviceDao(db);
  const smsDao = new SmsDao(db);
  const auditDao = new AuditDao(db);
  const configDao = new ConfigDao(db);
  const backupService = new BackupService(db, dbPath);
  const syncEngine = new SyncEngine(db);
  const tunnelManager = new TunnelManager(configDao, 3000);

  // Resolve the center slug from the DB when it's not yet in config so the
  // relay registration can always proceed (e.g. onboarding saved the center
  // info but the slug config write failed or was done by an older build).
  tunnelManager.setSlugFallback(async () => {
    try {
      const center = await centerDao.getCenterInfo();
      return center && center.center_name ? slugify(center.center_name) : '';
    } catch {
      return '';
    }
  });

  // Security Scoping Hook: Block administrative endpoints over public tunnel domain
  fastify.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host || '';
    const cfHost = (request.headers['x-forwarded-host'] as string) || '';
    const isPublicTunnel = host.includes('trycloudflare.com') || cfHost.includes('trycloudflare.com')
      || host.includes('cfargotunnel.com') || host.includes('tunnel.cloudflared.com');

    if (isPublicTunnel) {
      const url = request.url.split('?')[0];
      const isPublicRoute =
        url.startsWith('/parent') ||
        url.startsWith('/kiosk') ||
        url.startsWith('/pickup') ||
        // Hashed CSS/JS bundles for the PWA pages.
        url.startsWith('/assets') ||
        // Parent acknowledgment, portal & sign-out APIs
        url.startsWith('/api/parent') ||
        url.startsWith('/api/students/qr-lookup') ||
        url.startsWith('/api/students?') ||
        url.startsWith('/api/check-in') ||
        url.startsWith('/api/attendance/checked-in') ||
        url.startsWith('/api/attendance/checkout') ||
        url.startsWith('/api/sync') ||
        url.startsWith('/api/health') ||
        url === '/sw.js' ||
        url === '/manifest.json';

      if (!isPublicRoute) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Administrative endpoints cannot be accessed over public Cloudflare quick tunnel.',
        });
      }
    }
  });

  // Auto-boot Cloudflare Tunnel on startup. If a custom-domain `.env` file
  // exists it runs that named tunnel; otherwise a dynamic Cloudflare Quick
  // Tunnel is spawned automatically so parents can reach the portal with zero
  // configuration. Skipped while running the vitest suite.
  if (process.env.VITEST !== 'true') {
    tunnelManager.ensureActive().catch((err) => console.warn('Tunnel boot error:', err));
  }

  // Heartbeat: re-register the active tunnel URL with the Vercel relay every
  // 15s (managed inside TunnelManager). Vercel serverless functions are
  // ephemeral (in-memory store is lost on cold start), so the desktop must keep
  // the registration warm while running.
  if (process.env.VITEST !== 'true') {
    tunnelManager.startHeartbeat();
  }

  // Register static assets for the Check-In PWA so tablets on the local Wi-Fi
  // can open the check-in UI directly at http://<computer-ip>:3000/.
  // In sidecar mode, look for PWA assets in the Tauri resources directory
  // (passed through as TAURI_RESOURCE_DIR). In dev/standalone mode, look
  // relative to the working directory or the compiled output.
  const resourceDir = process.env.TAURI_RESOURCE_DIR || '';
  const pwaDistCandidates = [
    resourceDir ? path.join(resourceDir, 'check-in-pwa') : '',
    path.join(process.cwd(), 'apps', 'check-in-pwa', 'dist'),
    path.resolve(__dirname, '..', '..', 'check-in-pwa', 'dist'),
  ].filter(Boolean);

  const pwaDistPath = pwaDistCandidates.find(p => fs.existsSync(p)) || '';

  if (pwaDistPath && fs.existsSync(pwaDistPath)) {
    await fastify.register(fastifyStatic, {
      root: pwaDistPath,
      decorateReply: true,
      maxAge: '1d',
      immutable: true,
      etag: true,
      lastModified: true,
    });

    // Dedicated kiosk route — serves the tablet check-in page over the
    // Cloudflare tunnel so tablets can access it via HTTPS (required for
    // camera permissions on iOS/Android).
    fastify.get('/kiosk', async (_request, reply) => {
      const indexPath = path.join(pwaDistPath, 'index.html');
      const content = fs.readFileSync(indexPath, 'utf-8');
      return reply.type('text/html').send(content);
    });

    // Dedicated parent portal route — cleaner than /parent.html and
    // explicitly allowed over the public tunnel.
    fastify.get('/parent', async (_request, reply) => {
      const parentPath = path.join(pwaDistPath, 'parent.html');
      if (fs.existsSync(parentPath)) {
        const content = fs.readFileSync(parentPath, 'utf-8');
        return reply.type('text/html').send(content);
      }
      const indexPath = path.join(pwaDistPath, 'index.html');
      const content = fs.readFileSync(indexPath, 'utf-8');
      return reply.type('text/html').send(content);
    });

    console.log(`[Kumon SISO] Serving Check-In PWA from: ${pwaDistPath} at http://<ip>:3000/`);
    console.log(`[Kumon SISO] SPA routes: /kiosk, /parent, /pickup`);

    // SPA fallback: serve index.html for any non-API GET that doesn't match
    // an explicit route. This lets the client-side router handle paths like
    // /kiosk, /parent, /pickup, etc.
    const spaIndexHtml = fs.readFileSync(path.join(pwaDistPath, 'index.html'), 'utf-8');
    fastify.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.method === 'GET' && !req.raw.url.startsWith('/api')) {
        return reply.type('text/html').send(spaIndexHtml);
      }
      return reply.status(404).send({ message: 'Route not found', statusCode: 404 });
    });
  }

  // API Health & Info
  fastify.get('/api/health', async () => {
    const center = await centerDao.getCenterInfo();
    const integrity = await backupService.checkIntegrity();
    return {
      status: 'ok',
      center_name: center?.center_name || 'Unconfigured Center',
      is_onboarded: !!center?.is_onboarded,
      db_integrity: integrity.message,
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/api/network-info', async () => {
    const config = await configDao.getConfig();
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }

    const primaryIp = pickPrimaryLanIp(ips);
    const liveTunnelUrl = tunnelManager.getCurrentUrl();
    const publicTunnelUrl = liveTunnelUrl || (config.cloudflare_tunnel_enabled ? config.cloudflare_tunnel_url || '' : '');

    return {
      local_ips: ips,
      primary_ip: primaryIp,
      port: 3000,
      pwa_port: 3000,
      admin_port: 5174,
      server_port: 3000,
      localIpUrl: primaryIp ? `http://${primaryIp}:3000` : '',
      publicTunnelUrl,
      localIp: primaryIp,
      localUrl: primaryIp ? `http://${primaryIp}:3000` : '',
      tunnelUrl: publicTunnelUrl,
      pwa_urls: ips.map((ip) => `http://${ip}:3000`),
      admin_urls: ips.map((ip) => `http://${ip}:5174`),
    };
  });

  // Center Onboarding & Auth API
  fastify.post('/api/onboarding', async (request, reply) => {
    const body: any = request.body;
    if (!body.center_name || !body.contact_phone) {
      return reply.status(400).send({ error: 'Missing required onboarding parameters' });
    }

    const pinHash = body.staff_pin ? hashPin(body.staff_pin) : '';
    await centerDao.initializeCenter({
      center_name: body.center_name,
      contact_phone: body.contact_phone,
      time_zone: body.time_zone || 'America/New_York',
      staff_pin_hash: pinHash,
      logo_url: body.logo_url,
      accent_color: body.accent_color,
    });

    // Persistent branded slug for the Cloudflare Worker relay, e.g.
    // "Fremont Learning Center" -> "fremont-center".
    if (body.center_slug) {
      await configDao.setValue('center_slug', body.center_slug);
    } else if (body.center_name) {
      await configDao.setValue('center_slug', slugify(body.center_name));
    }
    if (body.relay_worker_url) {
      await configDao.setValue('relay_worker_url', body.relay_worker_url);
    }
    if (body.portal_base_url) {
      await configDao.setValue('portal_base_url', body.portal_base_url);
    }
    if (body.relay_secret) {
      await configDao.setValue('relay_secret', body.relay_secret);
    }
    await configDao.setValue('onboarding_completed', '1');

    await auditDao.log('CENTER_ONBOARDED', 'DESKTOP_ADMIN', { name: body.center_name });
    return { success: true, message: 'Center successfully onboarded' };
  });

  fastify.post('/api/auth/verify-pin', async (request, reply) => {
    const { pin }: any = request.body || {};
    const center = await centerDao.getCenterInfo();
    if (!center) return reply.status(400).send({ error: 'Center not onboarded' });

    const valid = verifyPin(pin, center.staff_pin_hash);
    if (!valid) {
      await auditDao.log('PIN_VERIFY_FAILED', 'DEVICE', { reason: 'Incorrect PIN' });
      return reply.status(401).send({ success: false, error: 'Invalid PIN' });
    }

    return { success: true };
  });

  // Students & Roster API
  fastify.get('/api/students', async (request) => {
    const { query, activeOnly }: any = request.query || {};
    if (query) {
      return studentDao.searchStudents(query);
    }
    return studentDao.getAllStudents(activeOnly !== 'false');
  });

  fastify.get('/api/students/qr-lookup/:qr', async (request, reply) => {
    const { qr }: any = request.params;
    console.log(`[QR Lookup] Scanning: "${qr}"`);
    const student = await studentDao.getStudentByQr(qr);
    if (!student) {
      console.warn(`[QR Lookup] No student found for QR: "${qr}"`);
      return reply.status(404).send({ error: 'Student not found for scanned QR code' });
    }

    const matchingClasses = await studentDao.getMatchingClassesForStudent(student.id, new Date());
    return { student, matchingClasses };
  });

  fastify.post('/api/students/import', async (request, reply) => {
    const { csvContent, mapping }: any = request.body || {};
    if (!csvContent) return reply.status(400).send({ error: 'csvContent is required' });

    const preview = parseAndValidateCsv(csvContent, mapping);
    if (preview.errorCount > 0 && !(request.query as any)?.allowPartial) {
      return reply.status(422).send({
        error: 'Import validation errors detected',
        preview,
        errorReportCsv: generateErrorReportCsv(preview.rows),
      });
    }

    let importedCount = 0;
    for (const r of preview.rows) {
      if (r.isValid) {
        await studentDao.createStudent({
          student_id: r.studentId,
          student_name: r.studentName,
          parent1_phone: r.parent1Phone,
          parent2_phone: r.parent2Phone,
        });
        importedCount++;
      }
    }

    await auditDao.log('ROSTER_IMPORTED', 'ADMIN', { importedCount, totalRows: preview.rows.length });
    return { success: true, importedCount, preview };
  });

  fastify.post('/api/students/qr-pdf', async (request, reply) => {
    // PDF generation is handled client-side via jsPDF in the Desktop Admin GUI.
    // This endpoint remains for API compatibility but returns instructions.
    return reply.status(200).send({
      message: 'QR card PDF generation is now handled client-side by the Desktop Admin. Use the QR Code Print Center in the admin GUI to download PDFs.',
      clientSideGeneration: true,
    });
  });

  // Attendance API
  fastify.get('/api/attendance/checked-in', async () => {
    return attendanceDao.getCurrentlyCheckedInStudents();
  });

  fastify.get('/api/attendance/pending-pickups', async () => {
    return attendanceDao.getPendingPickupRequests();
  });

  fastify.get('/api/attendance/history', async (request) => {
    const filters: any = request.query || {};
    return attendanceDao.getAttendanceHistory({
      startDate: filters.startDate,
      endDate: filters.endDate,
      studentId: filters.studentId,
      classId: filters.classId,
      missingDropoffAck: filters.missingDropoffAck === 'true',
      missingPickupAck: filters.missingPickupAck === 'true',
      missingCheckout: filters.missingCheckout === 'true',
      overridesOnly: filters.overridesOnly === 'true',
    });
  });

  fastify.get('/api/attendance/export-csv', async (request, reply) => {
    const history = await attendanceDao.getAttendanceHistory((request.query as any) || {});
    const exportData = history.map((h) => ({
      'Session ID': h.id,
      'Student ID': h.student_number,
      'Student Name': h.student_name,
      Class: h.class_name,
      'Time In': h.student_time_in,
      'Time Out': h.student_time_out || 'N/A',
      'Duration (Mins)': h.duration_minutes ?? 'N/A',
      'Dropoff ACK': h.dropoff_ack_status,
      'Dropoff ACK Time': h.dropoff_ack_time || 'N/A',
      'Pickup ACK': h.pickup_ack_status,
      'Pickup ACK Time': h.pickup_ack_time || 'N/A',
      Override: h.is_override ? 'YES' : 'NO',
      'Override Reason': h.override_reason || '',
    }));

    const csv = Papa.unparse(exportData);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="attendance_report.csv"');
    return reply.send(csv);
  });

  fastify.post('/api/attendance/checkout', async (request, reply) => {
    const { sessionId, deviceId, isOverride, overrideReason }: any = request.body || {};

    const now = new Date().toISOString();
    if (isOverride) {
      await attendanceDao.checkoutStudentWithOverride(
        sessionId,
        deviceId || 'DESKTOP_ADMIN',
        now,
        overrideReason || ''
      );
    } else {
      await attendanceDao.checkoutStudent(sessionId, deviceId || 'DESKTOP_ADMIN', now);
    }

    const session = await attendanceDao.getSessionById(sessionId);
    let duration_text: string | null = null;
    if (session?.student_time_in && session?.student_time_out) {
      const diffMs = new Date(session.student_time_out).getTime() - new Date(session.student_time_in).getTime();
      const mins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      duration_text = mins < 60 ? `${mins}m` : (mins % 60 > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`);
    }
    return { success: true, duration_text };
  });

  // Atomic Real-Time Check-In / Check-Out
  // Network-first endpoint used by the tablet kiosk. No schedule validation,
  // no staff PIN, no reason required — any roster student can toggle.
  fastify.post('/api/check-in', async (request, reply) => {
    const { studentId, timestamp, action, deviceId }: any = request.body || {};
    if (!studentId) return reply.status(400).send({ error: 'studentId is required' });

    const student = await studentDao.getStudentById(studentId);
    if (!student) return reply.status(404).send({ error: 'Student not found' });

    const time = timestamp || new Date().toISOString();
    const active = await attendanceDao.getActiveSessionForStudent(student.id);

    // action: 'check_in' forces a check-in, 'check_out' forces a checkout,
    // 'auto' (default) toggles based on current state.
    const wantCheckIn = !active || (action === 'check_in' && !active);

    if (wantCheckIn && action !== 'check_out') {
      const walkin = await studentDao.ensureWalkinClass();
      const session = await attendanceDao.createCheckinSession({
        sessionId: undefined,
        studentId: student.id,
        classId: walkin.id,
        timeIn: time,
        deviceId: deviceId || 'KIOSK',
      });
      await auditDao.log('STUDENT_CHECKED_IN', deviceId || 'KIOSK', { studentId: student.id, name: student.student_name });
      return {
        success: true,
        status: 'checked_in',
        student: { id: student.id, name: student.student_name, student_id: student.student_id },
        session: { timeIn: session.student_time_in, timeOut: null, duration: null },
      };
    }

    if (active && action !== 'check_in') {
      await attendanceDao.checkoutStudent(active.id, deviceId || 'KIOSK', time);
      const session = await attendanceDao.getSessionById(active.id);
      const diffMs = session?.student_time_in && session?.student_time_out
        ? new Date(session.student_time_out).getTime() - new Date(session.student_time_in).getTime()
        : 0;
      const duration = Math.max(0, Math.floor(diffMs / (1000 * 60)));
      await auditDao.log('STUDENT_CHECKED_OUT', deviceId || 'KIOSK', { studentId: student.id, name: student.student_name, duration });
      return {
        success: true,
        status: 'checked_out',
        student: { id: student.id, name: student.student_name, student_id: student.student_id },
        session: { timeIn: session?.student_time_in, timeOut: session?.student_time_out, duration },
      };
    }

    // Already in the requested state — idempotent success
    const state = active ? 'checked_in' : 'checked_out';
    return {
      success: true,
      status: state,
      student: { id: student.id, name: student.student_name, student_id: student.student_id },
      session: active
        ? { timeIn: active.student_time_in, timeOut: null, duration: null }
        : { timeIn: null, timeOut: null, duration: null },
    };
  });

  // Today's attendance (admin dashboard auto-polling)
  fastify.get('/api/attendance/today', async () => {
    return attendanceDao.getAttendanceToday();
  });

  // Device Pairing & Sync API
  fastify.post('/api/devices/pair-code', async (request) => {
    const { deviceName }: any = request.body || {};
    return deviceDao.generatePairingCode(deviceName || 'Tablet Check-In');
  });

  fastify.post('/api/sync', async (request, reply) => {
    const payload: any = request.body;
    if (!payload || !Array.isArray(payload.events)) {
      return reply.status(400).send({ error: 'Invalid sync payload' });
    }

    // New streamlined schema: [{ studentId, timestamp, action }]
    // Detect by absence of event_type / idempotency_key fields.
    const isStreamlined = payload.events.length === 0 || !payload.events[0]?.event_type;

    if (isStreamlined) {
      const processedEventIds: string[] = [];
      const errors: Array<{ event_id: string; error: string }> = [];

      for (const evt of payload.events) {
        const key = evt.id || evt.studentId || '';
        try {
          if (!evt.studentId) throw new Error('Missing studentId');
          const student = await studentDao.getStudentById(evt.studentId);
          if (!student) throw new Error('Student not found');
          const time = evt.timestamp || new Date().toISOString();
          const active = await attendanceDao.getActiveSessionForStudent(evt.studentId);

          if (evt.action === 'check_out' || (evt.action !== 'check_in' && active)) {
            if (active) {
              await attendanceDao.checkoutStudent(active.id, payload.device_id || 'KIOSK_SYNC', time);
            }
          } else {
            const walkin = await studentDao.ensureWalkinClass();
            await attendanceDao.createCheckinSession({
              sessionId: undefined,
              studentId: evt.studentId,
              classId: walkin.id,
              timeIn: time,
              deviceId: payload.device_id || 'KIOSK_SYNC',
            });
          }
          processedEventIds.push(key);
        } catch (err: any) {
          errors.push({ event_id: key, error: err.message || 'Processing error' });
        }
      }

      await auditDao.log('DEVICE_SYNC', payload.device_id || 'KIOSK_SYNC', {
        total: payload.events.length,
        processed: processedEventIds.length,
        errorsCount: errors.length,
      });
      if (payload.device_id) {
        await deviceDao.updateLastSeen(payload.device_id, payload.events.length);
      }
      return {
        success: errors.length === 0,
        processed: processedEventIds.length,
        processed_event_ids: processedEventIds,
        acknowledged_count: processedEventIds.length,
        errors,
        server_timestamp: new Date().toISOString(),
      };
    }

    // Legacy full-event schema: { device_id, events: [{ id, event_type, ... }] }
    const result = await syncEngine.processSync(payload);
    await deviceDao.updateLastSeen(payload.device_id, payload.events.length);
    return result;
  });

  // Public Parent Acknowledgment Links REST API
  fastify.post('/api/parent/ack-dropoff', async (request, reply) => {
    const { sessionId, maskedPhone }: any = request.body || {};
    if (!sessionId) return reply.status(400).send({ error: 'Session ID required' });

    await attendanceDao.recordDropoffAck(sessionId, maskedPhone || 'Parent Web Link', new Date().toISOString());
    await auditDao.log('PARENT_DROPOFF_ACKNOWLEDGED', 'PARENT_WEB', { sessionId });
    return { success: true, message: 'Drop-off acknowledgment recorded. Thank you!' };
  });

  fastify.post('/api/parent/request-pickup', async (request, reply) => {
    const { sessionId, maskedPhone }: any = request.body || {};
    if (!sessionId) return reply.status(400).send({ error: 'Session ID required' });

    await attendanceDao.recordPickupAck(sessionId, maskedPhone || 'Parent Web Link', new Date().toISOString());
    await auditDao.log('PARENT_PICKUP_REQUESTED', 'PARENT_WEB', { sessionId });
    return { success: true, message: 'Pickup request sent to staff. Please wait for physical release.' };
  });

  // Public Parent Web Portal API
  // Lets parents check their child's live check-in status and sign them out
  // from the front-window portal page (`/parent.html`).
  fastify.get('/api/parent/students', async (request, reply) => {
    const { firstName = '', lastName = '' }: any = request.query || {};
    const terms = `${firstName} ${lastName}`.trim().toLowerCase().split(/\s+/).filter(Boolean);

    let students = await studentDao.getAllStudents(true);
    if (terms.length > 0) {
      students = students.filter((s) => {
        const name = s.student_name.toLowerCase();
        return terms.every((t) => name.includes(t));
      });
    }
    students = students.slice(0, 20);

    const activeSessions = await attendanceDao.getCurrentlyCheckedInStudents();
    const activeByStudentId = new Map<string, any>();
    for (const session of activeSessions) {
      activeByStudentId.set(session.student_id, session);
    }

    return students.map((s) => {
      const active = activeByStudentId.get(s.id);
      return {
        id: s.id,
        student_id: s.student_id,
        student_name: s.student_name,
        checked_in: !!active,
        session_id: active?.id ?? null,
        time_in: active?.student_time_in ?? null,
        class_name: active?.class_name ?? null,
        duration_text: active?.duration_text ?? null,
      };
    });
  });

  fastify.post('/api/parent/signout', async (request, reply) => {
    const { sessionId }: any = request.body || {};
    if (!sessionId) return reply.status(400).send({ error: 'Session ID required' });

    const session = await attendanceDao.getSessionById(sessionId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.student_time_out) {
      return reply.status(409).send({ error: 'Student is already checked out' });
    }

    await attendanceDao.checkoutStudent(sessionId, 'PARENT_WEB_PORTAL', new Date().toISOString());
    await auditDao.log('PARENT_PORTAL_SIGNOUT', 'PARENT_WEB', { sessionId, student: session.student_name });
    return { success: true, message: `${session.student_name} signed out successfully.` };
  });

  // Backup & Restore API
  fastify.post('/api/backup/create', async (request) => {
    const { targetDir }: any = request.body || {};
    return backupService.createBackup(targetDir || './backups');
  });

  fastify.post('/api/backup/export-package', async () => {
    const packagePath = await backupService.exportTransferPackage('./export_packages');
    return { success: true, packagePath };
  });

  // System Config & Notifications REST API
  fastify.get('/api/config', async () => {
    const config = await configDao.getConfig();
    const liveUrl = tunnelManager.getCurrentUrl();
    if (liveUrl) {
      config.cloudflare_tunnel_url = liveUrl;
    }
    return config;
  });

  fastify.post('/api/config', async (request) => {
    const body: any = request.body || {};
    const updated = await configDao.updateConfig(body);

    // Handle Cloudflare Tunnel toggle dynamically
    if (body.cloudflare_tunnel_enabled === true) {
      await tunnelManager.start();
    } else if (body.cloudflare_tunnel_enabled === false) {
      tunnelManager.stop();
      await configDao.setValue('cloudflare_tunnel_url', '');
    }

    // Restart tunnel if a new persistent token was provided
    if (body.cloudflare_tunnel_token && body.cloudflare_tunnel_enabled !== false) {
      tunnelManager.stop();
      await tunnelManager.start();
    }

    await auditDao.log('CONFIG_UPDATED', 'DESKTOP_ADMIN', { provider: updated.notification_provider, tunnel: updated.cloudflare_tunnel_enabled });
    return configDao.getConfig();
  });

  fastify.post('/api/config/test-notification', async (request) => {
    const { recipient, message }: any = request.body || {};
    const currentConfig = await configDao.getConfig();
    const dispatcher = new NotificationDispatcher(currentConfig, './sms_outbox');
    const result = await dispatcher.sendSms(recipient || '+15551234567', message || 'Test alert from Kumon SISO');
    return result;
  });

  // Diagnostics & Redacted Log Export
  fastify.get('/api/diagnostics/logs', async () => {
    const logs = await auditDao.getRecentLogs(100);
    return logs;
  });

  return { fastify, db, centerDao, studentDao, attendanceDao, deviceDao, smsDao, auditDao, configDao, tunnelManager };
}
