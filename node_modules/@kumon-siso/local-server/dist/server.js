"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const static_1 = __importDefault(require("@fastify/static"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const database_1 = require("@kumon-siso/database");
const sync_1 = require("@kumon-siso/sync");
const sms_adapters_1 = require("@kumon-siso/sms-adapters");
const shared_1 = require("@kumon-siso/shared");
const qr_1 = require("@kumon-siso/qr");
const import_1 = require("@kumon-siso/import");
const tunnelManager_js_1 = require("./services/tunnelManager.js");
const papaparse_1 = __importDefault(require("papaparse"));
async function createServer(dbPath = './data/kumon_siso.sqlite') {
    const fastify = (0, fastify_1.default)({ logger: true });
    await fastify.register(cors_1.default, { origin: true });
    const db = new database_1.Database(dbPath);
    await db.init();
    const centerDao = new database_1.CenterDao(db);
    const studentDao = new database_1.StudentDao(db);
    const attendanceDao = new database_1.AttendanceDao(db);
    const deviceDao = new database_1.DeviceDao(db);
    const smsDao = new database_1.SmsDao(db);
    const auditDao = new database_1.AuditDao(db);
    const configDao = new database_1.ConfigDao(db);
    const backupService = new database_1.BackupService(db, dbPath);
    const syncEngine = new sync_1.SyncEngine(db);
    const tunnelManager = new tunnelManager_js_1.TunnelManager(configDao, 3000);
    // Security Scoping Hook: Block administrative endpoints over public tunnel domain
    fastify.addHook('onRequest', async (request, reply) => {
        const host = request.headers.host || '';
        const cfHost = request.headers['x-forwarded-host'] || '';
        const isPublicTunnel = host.includes('trycloudflare.com') || cfHost.includes('trycloudflare.com');
        if (isPublicTunnel) {
            const url = request.url;
            const isPublicRoute = url.startsWith('/parent') ||
                url.startsWith('/api/parent') ||
                url.startsWith('/api/health') ||
                url.startsWith('/sw.js');
            if (!isPublicRoute) {
                reply.status(403).send({
                    error: 'Forbidden',
                    message: 'Administrative endpoints cannot be accessed over public Cloudflare quick tunnel.',
                });
            }
        }
    });
    // Auto-boot Cloudflare Quick Tunnel if enabled in config
    const sysConfig = await configDao.getConfig();
    if (sysConfig.cloudflare_tunnel_enabled) {
        tunnelManager.start().catch((err) => console.warn('Tunnel boot error:', err));
    }
    // Register Static Assets for PWA and Admin client web builds
    // In sidecar mode, look for PWA assets in the Tauri resources directory.
    // In dev/standalone mode, look relative to the working directory.
    const resourceDir = process.env.TAURI_RESOURCE_DIR || '';
    const pwaDistCandidates = [
        resourceDir ? node_path_1.default.join(resourceDir, 'check-in-pwa') : '',
        node_path_1.default.join(process.cwd(), 'apps', 'check-in-pwa', 'dist'),
        node_path_1.default.resolve(__dirname, '..', '..', 'check-in-pwa', 'dist'),
    ].filter(Boolean);
    const pwaDistPath = pwaDistCandidates.find(p => node_fs_1.default.existsSync(p)) || pwaDistCandidates[1];
    const adminDistPath = node_path_1.default.join(process.cwd(), 'apps', 'desktop-admin', 'dist');
    // Serve Check-In PWA as static files so tablets can access http://<ip>:3000/
    if (node_fs_1.default.existsSync(pwaDistPath)) {
        await fastify.register(static_1.default, {
            root: pwaDistPath,
            prefix: '/',
            wildcard: false, // Don't catch API routes
            decorateReply: true,
        });
        console.log(`[Kumon SISO] Serving Check-In PWA from: ${pwaDistPath}`);
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
        const os = await import('node:os');
        const interfaces = os.networkInterfaces();
        const ips = [];
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
        return {
            local_ips: ips,
            pwa_port: 5173,
            admin_port: 5174,
            server_port: 3000,
            pwa_urls: ips.map((ip) => `http://${ip}:5173`),
            admin_urls: ips.map((ip) => `http://${ip}:5174`),
        };
    });
    // Center Onboarding & Auth API
    fastify.post('/api/onboarding', async (request, reply) => {
        const body = request.body;
        if (!body.center_name || !body.contact_phone || !body.staff_pin) {
            return reply.status(400).send({ error: 'Missing required onboarding parameters' });
        }
        const pinHash = (0, shared_1.hashPin)(body.staff_pin);
        await centerDao.initializeCenter({
            center_name: body.center_name,
            contact_phone: body.contact_phone,
            time_zone: body.time_zone || 'America/New_York',
            staff_pin_hash: pinHash,
            logo_url: body.logo_url,
            accent_color: body.accent_color,
        });
        await auditDao.log('CENTER_ONBOARDED', 'DESKTOP_ADMIN', { name: body.center_name });
        return { success: true, message: 'Center successfully onboarded' };
    });
    fastify.post('/api/auth/verify-pin', async (request, reply) => {
        const { pin } = request.body || {};
        const center = await centerDao.getCenterInfo();
        if (!center)
            return reply.status(400).send({ error: 'Center not onboarded' });
        const valid = (0, shared_1.verifyPin)(pin, center.staff_pin_hash);
        if (!valid) {
            await auditDao.log('PIN_VERIFY_FAILED', 'DEVICE', { reason: 'Incorrect PIN' });
            return reply.status(401).send({ success: false, error: 'Invalid PIN' });
        }
        return { success: true };
    });
    // Students & Roster API
    fastify.get('/api/students', async (request) => {
        const { query, activeOnly } = request.query || {};
        if (query) {
            return studentDao.searchStudents(query);
        }
        return studentDao.getAllStudents(activeOnly !== 'false');
    });
    fastify.get('/api/students/qr-lookup/:qr', async (request, reply) => {
        const { qr } = request.params;
        const student = await studentDao.getStudentByQr(qr);
        if (!student) {
            return reply.status(404).send({ error: 'Student not found for scanned QR code' });
        }
        const matchingClasses = await studentDao.getMatchingClassesForStudent(student.id, new Date());
        return { student, matchingClasses };
    });
    fastify.post('/api/students/import', async (request, reply) => {
        const { csvContent, mapping } = request.body || {};
        if (!csvContent)
            return reply.status(400).send({ error: 'csvContent is required' });
        const preview = (0, import_1.parseAndValidateCsv)(csvContent, mapping);
        if (preview.errorCount > 0 && !request.query?.allowPartial) {
            return reply.status(422).send({
                error: 'Import validation errors detected',
                preview,
                errorReportCsv: (0, import_1.generateErrorReportCsv)(preview.rows),
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
        const { studentIds } = request.body || {};
        const center = await centerDao.getCenterInfo();
        let students = await studentDao.getAllStudents(true);
        if (Array.isArray(studentIds) && studentIds.length > 0) {
            students = students.filter((s) => studentIds.includes(s.id));
        }
        const cardItems = students.map((s) => ({
            studentName: s.student_name,
            studentId: s.student_id,
            qrIdentifier: s.qr_identifier,
        }));
        const pdfBuffer = await (0, qr_1.generateQrCardsPdf)(cardItems, center?.center_name || 'Kumon SISO Center');
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', 'attachment; filename="student_qr_cards.pdf"');
        return reply.send(pdfBuffer);
    });
    // Attendance API
    fastify.get('/api/attendance/checked-in', async () => {
        return attendanceDao.getCurrentlyCheckedInStudents();
    });
    fastify.get('/api/attendance/pending-pickups', async () => {
        return attendanceDao.getPendingPickupRequests();
    });
    fastify.get('/api/attendance/history', async (request) => {
        const filters = request.query || {};
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
        const history = await attendanceDao.getAttendanceHistory(request.query || {});
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
        const csv = papaparse_1.default.unparse(exportData);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="attendance_report.csv"');
        return reply.send(csv);
    });
    fastify.post('/api/attendance/checkout', async (request, reply) => {
        const { sessionId, deviceId, isOverride, overrideReason, staffPin } = request.body || {};
        if (isOverride) {
            const center = await centerDao.getCenterInfo();
            if (!staffPin || !(0, shared_1.verifyPin)(staffPin, center?.staff_pin_hash || '')) {
                return reply.status(401).send({ error: 'Valid Staff PIN required for checkout override' });
            }
            if (!overrideReason) {
                return reply.status(400).send({ error: 'Override reason is required' });
            }
            await attendanceDao.checkoutStudentWithOverride(sessionId, deviceId || 'DESKTOP_ADMIN', new Date().toISOString(), overrideReason);
        }
        else {
            await attendanceDao.checkoutStudent(sessionId, deviceId || 'DESKTOP_ADMIN', new Date().toISOString());
        }
        return { success: true };
    });
    // Device Pairing & Sync API
    fastify.post('/api/devices/pair-code', async (request) => {
        const { deviceName } = request.body || {};
        return deviceDao.generatePairingCode(deviceName || 'Tablet Check-In');
    });
    fastify.post('/api/sync', async (request, reply) => {
        const payload = request.body;
        if (!payload || !payload.device_id || !Array.isArray(payload.events)) {
            return reply.status(400).send({ error: 'Invalid sync payload' });
        }
        const result = await syncEngine.processSync(payload);
        await deviceDao.updateLastSeen(payload.device_id, payload.events.length);
        return result;
    });
    // Public Parent Acknowledgment Links REST API
    fastify.post('/api/parent/ack-dropoff', async (request, reply) => {
        const { sessionId, maskedPhone } = request.body || {};
        if (!sessionId)
            return reply.status(400).send({ error: 'Session ID required' });
        await attendanceDao.recordDropoffAck(sessionId, maskedPhone || 'Parent Web Link', new Date().toISOString());
        await auditDao.log('PARENT_DROPOFF_ACKNOWLEDGED', 'PARENT_WEB', { sessionId });
        return { success: true, message: 'Drop-off acknowledgment recorded. Thank you!' };
    });
    fastify.post('/api/parent/request-pickup', async (request, reply) => {
        const { sessionId, maskedPhone } = request.body || {};
        if (!sessionId)
            return reply.status(400).send({ error: 'Session ID required' });
        await attendanceDao.recordPickupAck(sessionId, maskedPhone || 'Parent Web Link', new Date().toISOString());
        await auditDao.log('PARENT_PICKUP_REQUESTED', 'PARENT_WEB', { sessionId });
        return { success: true, message: 'Pickup request sent to staff. Please wait for physical release.' };
    });
    // Backup & Restore API
    fastify.post('/api/backup/create', async (request) => {
        const { targetDir } = request.body || {};
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
        const body = request.body || {};
        const updated = await configDao.updateConfig(body);
        // Handle Cloudflare Tunnel toggle dynamically
        if (body.cloudflare_tunnel_enabled === true) {
            await tunnelManager.start();
        }
        else if (body.cloudflare_tunnel_enabled === false) {
            tunnelManager.stop();
            await configDao.setValue('cloudflare_tunnel_url', '');
        }
        await auditDao.log('CONFIG_UPDATED', 'DESKTOP_ADMIN', { provider: updated.notification_provider, tunnel: updated.cloudflare_tunnel_enabled });
        return configDao.getConfig();
    });
    fastify.post('/api/config/test-notification', async (request) => {
        const { recipient, message } = request.body || {};
        const currentConfig = await configDao.getConfig();
        const dispatcher = new sms_adapters_1.NotificationDispatcher(currentConfig, './sms_outbox');
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
