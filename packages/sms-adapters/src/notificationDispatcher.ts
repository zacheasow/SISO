import { SmsAdapter, SmsSendResult } from './interface.js';
import { DevOutboxAdapter } from './devOutboxAdapter.js';
import { TwilioAdapter } from './twilioAdapter.js';
import { WebPushAdapter } from './webPushAdapter.js';
import { TelegramAdapter } from './telegramAdapter.js';
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
      case 'TELEGRAM':
        return new TelegramAdapter(
          this.config.telegram_bot_token,
          this.config.telegram_chat_id
        );
      case 'TWILIO':
        return new TwilioAdapter(
          this.config.twilio_account_sid || '',
          this.config.twilio_auth_token || '',
          this.config.twilio_from_number || ''
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
