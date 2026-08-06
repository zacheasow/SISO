import { SmsAdapter, SmsSendResult } from './interface.js';

export class TelegramAdapter implements SmsAdapter {
  name = 'Telegram Bot Gateway';

  constructor(
    private botToken?: string,
    private defaultChatId?: string
  ) {}

  async sendSms(to: string, message: string): Promise<SmsSendResult> {
    const token = this.botToken;
    const chatId = to.startsWith('-') || to.match(/^\d+$/) ? to : this.defaultChatId;

    if (!token || !chatId) {
      return {
        success: false,
        error: 'Telegram bot token or chat ID not configured in Admin GUI.',
      };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const data: any = await response.json();
      if (!response.ok || !data.ok) {
        return {
          success: false,
          error: data.description || `Telegram Error HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: String(data.result?.message_id || Date.now()),
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
