"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
class TelegramAdapter {
    botToken;
    defaultChatId;
    name = 'Telegram Bot Gateway';
    constructor(botToken, defaultChatId) {
        this.botToken = botToken;
        this.defaultChatId = defaultChatId;
    }
    async sendSms(to, message) {
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
            const data = await response.json();
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
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
}
exports.TelegramAdapter = TelegramAdapter;
