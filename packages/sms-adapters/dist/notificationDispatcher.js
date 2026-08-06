"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcher = void 0;
const devOutboxAdapter_js_1 = require("./devOutboxAdapter.js");
const webPushAdapter_js_1 = require("./webPushAdapter.js");
class NotificationDispatcher {
    config;
    outboxDir;
    name = 'Unified Notification Dispatcher';
    constructor(config, outboxDir = './sms_outbox') {
        this.config = config;
        this.outboxDir = outboxDir;
    }
    getAdapter() {
        switch (this.config.notification_provider) {
            case 'WEB_PUSH':
                return new webPushAdapter_js_1.WebPushAdapter(this.config.vapid_public_key, this.config.vapid_private_key, this.config.vapid_subject);
            case 'DEV_OUTBOX':
            default:
                return new devOutboxAdapter_js_1.DevOutboxAdapter(this.outboxDir);
        }
    }
    async sendSms(to, message) {
        const adapter = this.getAdapter();
        return adapter.sendSms(to, message);
    }
}
exports.NotificationDispatcher = NotificationDispatcher;
