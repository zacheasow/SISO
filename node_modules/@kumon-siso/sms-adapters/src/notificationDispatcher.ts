import { SmsAdapter, SmsSendResult } from './interface.js';
import { DevOutboxAdapter } from './devOutboxAdapter.js';
import { WebPushAdapter } from './webPushAdapter.js';
import { SystemConfig } from '@kumon-siso/shared';

export class NotificationDispatcher implements SmsAdapter {
  name = 'Unified Notification Dispatcher';

  constructor(private config: SystemConfig, private outboxDir = './sms_outbox') {}

  getAdapter(): SmsAdapter {
    switch (this.config.notification_provider) {
      case 'WEB_PUSH':
        return new WebPushAdapter(
          this.config.vapid_public_key,
          this.config.vapid_private_key,
          this.config.vapid_subject
        );
      case 'DEV_OUTBOX':
      default:
        return new DevOutboxAdapter(this.outboxDir);
    }
  }

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const adapter = this.getAdapter();
    return adapter.sendSms(to, message);
  }
}
