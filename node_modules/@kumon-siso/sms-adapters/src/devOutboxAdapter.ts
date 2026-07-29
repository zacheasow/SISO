import { SmsAdapter, SmsSendResult } from './interface.js';
import fs from 'node:fs';
import path from 'node:path';

export class DevOutboxAdapter implements SmsAdapter {
  name = 'Development Local Outbox';
  private outboxPath: string;

  constructor(outboxDir = './sms_outbox') {
    this.outboxPath = outboxDir;
    if (!fs.existsSync(this.outboxPath)) {
      fs.mkdirSync(this.outboxPath, { recursive: true });
    }
  }

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sms_${timestamp}_${Math.random().toString(36).substring(2, 7)}.json`;
    const filePath = path.join(this.outboxPath, filename);

    const payload = {
      timestamp: new Date().toISOString(),
      to,
      message,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

    return {
      success: true,
      messageId: filename,
    };
  }
}
