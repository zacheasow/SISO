"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceDao = void 0;
const shared_1 = require("@kumon-siso/shared");
const node_crypto_1 = require("node:crypto");
class DeviceDao {
    db;
    constructor(db) {
        this.db = db;
    }
    async getAllDevices() {
        return this.db.all('SELECT * FROM paired_devices ORDER BY paired_at DESC');
    }
    async getDeviceById(id) {
        return this.db.get('SELECT * FROM paired_devices WHERE id = ?', [id]);
    }
    async getDeviceByAuthToken(token) {
        const hashed = (0, shared_1.hashToken)(token);
        return this.db.get('SELECT * FROM paired_devices WHERE auth_token_hash = ? AND is_active = 1', [hashed]);
    }
    async generatePairingCode(deviceName) {
        const id = (0, node_crypto_1.randomUUID)();
        const rawAuthToken = (0, shared_1.generateSecureToken)(32);
        const authTokenHash = (0, shared_1.hashToken)(rawAuthToken);
        const pairingCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit short code
        await this.db.run(`INSERT INTO paired_devices (id, device_name, pairing_code, auth_token_hash)
       VALUES (?, ?, ?, ?)`, [id, deviceName, pairingCode, authTokenHash]);
        const device = (await this.getDeviceById(id));
        return { device, rawAuthToken, pairingCode };
    }
    async updateLastSeen(deviceId, pendingCount = 0) {
        await this.db.run(`UPDATE paired_devices SET
        last_seen_at = CURRENT_TIMESTAMP,
        last_sync_at = CURRENT_TIMESTAMP,
        pending_event_count = ?
       WHERE id = ?`, [pendingCount, deviceId]);
    }
    async revokeDevice(deviceId) {
        await this.db.run('UPDATE paired_devices SET is_active = 0 WHERE id = ?', [deviceId]);
    }
}
exports.DeviceDao = DeviceDao;
