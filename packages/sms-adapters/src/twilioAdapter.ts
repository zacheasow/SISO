import { SmsAdapter, SmsSendResult } from './interface.js';

export class TwilioAdapter implements SmsAdapter {
  name = 'Twilio SMS Gateway';

  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string
  ) {}

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', this.fromNumber);
      params.append('Body', message);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data: any = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || `Twilio Error HTTP ${response.status}` };
      }

      return { success: true, messageId: data.sid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
