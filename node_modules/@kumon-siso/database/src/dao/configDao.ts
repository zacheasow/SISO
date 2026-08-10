import { Database } from '../db.js';
import { SystemConfig } from '@kumon-siso/shared';

export class ConfigDao {
  private cache = new Map<string, string>();

  constructor(private db: Database) {}

  async getValue(key: string, defaultValue = ''): Promise<string> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const row = await this.db.get<{ value: string }>('SELECT value FROM system_config WHERE key = ?', [key]);
    const val = row ? row.value : defaultValue;
    this.cache.set(key, val);
    return val;
  }

  async setValue(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
    await this.db.run(
      `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  async getConfig(): Promise<SystemConfig> {
    const cloudflareEnabled = (await this.getValue('cloudflare_tunnel_enabled', '0')) === '1';
    const cloudflareUrl = await this.getValue('cloudflare_tunnel_url', '');
    const notificationProvider = (await this.getValue('notification_provider', 'DEV_OUTBOX')) as any;
    const vapidPublicKey = await this.getValue('vapid_public_key', '');
    const vapidPrivateKey = await this.getValue('vapid_private_key', '');
    const vapidSubject = await this.getValue('vapid_subject', 'mailto:admin@kumon-siso.local');

    return {
      cloudflare_tunnel_enabled: cloudflareEnabled,
      cloudflare_tunnel_url: cloudflareUrl,
      notification_provider: notificationProvider,
      vapid_public_key: vapidPublicKey,
      vapid_private_key: vapidPrivateKey,
      vapid_subject: vapidSubject,
    };
  }

  async updateConfig(partial: Partial<SystemConfig>): Promise<SystemConfig> {
    if (partial.cloudflare_tunnel_enabled !== undefined) {
      await this.setValue('cloudflare_tunnel_enabled', partial.cloudflare_tunnel_enabled ? '1' : '0');
    }
    if (partial.cloudflare_tunnel_url !== undefined) {
      await this.setValue('cloudflare_tunnel_url', partial.cloudflare_tunnel_url);
    }
    if (partial.notification_provider !== undefined) {
      await this.setValue('notification_provider', partial.notification_provider);
    }
    if (partial.vapid_public_key !== undefined) {
      await this.setValue('vapid_public_key', partial.vapid_public_key);
    }
    if (partial.vapid_private_key !== undefined) {
      await this.setValue('vapid_private_key', partial.vapid_private_key);
    }
    if (partial.vapid_subject !== undefined) {
      await this.setValue('vapid_subject', partial.vapid_subject);
    }

    return this.getConfig();
  }
}
