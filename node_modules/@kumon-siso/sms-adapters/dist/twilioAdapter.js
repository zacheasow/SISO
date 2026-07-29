"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioAdapter = void 0;
class TwilioAdapter {
    accountSid;
    authToken;
    fromNumber;
    name = 'Twilio SMS Gateway';
    constructor(accountSid, authToken, fromNumber) {
        this.accountSid = accountSid;
        this.authToken = authToken;
        this.fromNumber = fromNumber;
    }
    async sendSms(to, message) {
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
            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.message || `Twilio Error HTTP ${response.status}` };
            }
            return { success: true, messageId: data.sid };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
}
exports.TwilioAdapter = TwilioAdapter;
