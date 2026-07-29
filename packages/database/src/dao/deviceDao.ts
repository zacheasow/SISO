import { Database } from '../db.js';
import { PairedDevice, generateSecureToken, hashToken } from '@kumon-siso/shared';
import { randomUUID } from 'node:crypto';

export class DeviceDao {
  constructor(private db: Database) {}

  async getAllDevices(): Promise<PairedDevice[]> {
    return this.db.all<PairedDevice>('SELECT * FROM paired_devices ORDER BY paired_at DESC');
  }

  async getDeviceById(id: string): Promise<PairedDevice | undefined> {
    return this.db.get<PairedDevice>('SELECT * FROM paired_devices WHERE id = ?', [id]);
  }

  async getDeviceByAuthToken(token: string): Promise<PairedDevice | undefined> {
    const hashed = hashToken(token);
    return this.db.get<PairedDevice>('SELECT * FROM paired_devices WHERE auth_token_hash = ? AND is_active = 1', [hashed]);
  }

  async generatePairingCode(deviceName: string): Promise<{ device: PairedDevice; rawAuthToken: string; pairingCode: string }> {
    const id = randomUUID();
    const rawAuthToken = generateSecureToken(32);
    const authTokenHash = hashToken(rawAuthToken);
    const pairingCode = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit short code

    await this.db.run(
      `INSERT INTO paired_devices (id, device_name, pairing_code, auth_token_hash)
       VALUES (?, ?, ?, ?)`,
      [id, deviceName, pairingCode, authTokenHash]
    );

    const device = (await this.getDeviceById(id))!;
    return { device, rawAuthToken, pairingCode };
  }

  async updateLastSeen(deviceId: string, pendingCount = 0): Promise<void> {
    await this.db.run(
      `UPDATE paired_devices SET
        last_seen_at = CURRENT_TIMESTAMP,
        last_sync_at = CURRENT_TIMESTAMP,
        pending_event_count = ?
       WHERE id = ?`,
      [pendingCount, deviceId]
    );
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.db.run('UPDATE paired_devices SET is_active = 0 WHERE id = ?', [deviceId]);
  }
}
