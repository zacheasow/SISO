import { Database } from '../db.js';
import { SystemConfig, DEFAULT_PORTAL_BASE_URL } from '@kumon-siso/shared';

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
    const cloudflareToken = await this.getValue('cloudflare_tunnel_token', '');
    const centerSlug = await this.getValue('center_slug', '');
    const relayWorkerUrl = await this.getValue('relay_worker_url', '');
    const portalBaseUrl = await this.getValue('portal_base_url', DEFAULT_PORTAL_BASE_URL);
    const relaySecret = await this.getValue('relay_secret', '');
    const onboardingCompleted = (await this.getValue('onboarding_completed', '0')) === '1';
    const notificationProvider = (await this.getValue('notification_provider', 'DEV_OUTBOX')) as any;
    const vapidPublicKey = await this.getValue('vapid_public_key', '');
    const vapidPrivateKey = await this.getValue('vapid_private_key', '');
    const vapidSubject = await this.getValue('vapid_subject', 'mailto:admin@kumon-siso.local');

    return {
      cloudflare_tunnel_enabled: cloudflareEnabled,
      cloudflare_tunnel_url: cloudflareUrl,
      cloudflare_tunnel_token: cloudflareToken,
      center_slug: centerSlug,
      relay_worker_url: relayWorkerUrl,
      portal_base_url: portalBaseUrl,
      relay_secret: relaySecret,
      onboarding_completed: onboardingCompleted,
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
    if (partial.cloudflare_tunnel_token !== undefined) {
      await this.setValue('cloudflare_tunnel_token', partial.cloudflare_tunnel_token);
    }
    if (partial.center_slug !== undefined) {
      await this.setValue('center_slug', partial.center_slug);
    }
    if (partial.relay_worker_url !== undefined) {
      await this.setValue('relay_worker_url', partial.relay_worker_url);
    }
    if (partial.portal_base_url !== undefined) {
      await this.setValue('portal_base_url', partial.portal_base_url);
    }
    if (partial.relay_secret !== undefined) {
      await this.setValue('relay_secret', partial.relay_secret);
    }
    if (partial.onboarding_completed !== undefined) {
      await this.setValue('onboarding_completed', partial.onboarding_completed ? '1' : '0');
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
