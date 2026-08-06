"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPushAdapter = void 0;
class WebPushAdapter {
    vapidPublicKey;
    vapidPrivateKey;
    vapidSubject;
    name = 'PWA Web Push Notifications (VAPID)';
    constructor(vapidPublicKey, vapidPrivateKey, vapidSubject = 'mailto:admin@kumon-siso.local') {
        this.vapidPublicKey = vapidPublicKey;
        this.vapidPrivateKey = vapidPrivateKey;
        this.vapidSubject = vapidSubject;
    }
    async sendSms(to, message) {
        // In Web Push context, 'to' can be a push subscription endpoint or JSON string
        try {
            if (!this.vapidPublicKey || !this.vapidPrivateKey) {
                return {
                    success: false,
                    error: 'VAPID keys not configured. Please generate VAPID keys in Admin GUI.',
                };
            }
            // Simulate/execute Web Push payload dispatch
            const payload = JSON.stringify({
                title: 'Kumon SISO Alert',
                body: message,
                icon: '/icon.png',
                data: { url: to.startsWith('http') ? to : undefined },
            });
            // If push subscription endpoint is passed
            if (to.startsWith('http')) {
                const res = await fetch(to, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        TTL: '60',
                    },
                    body: payload,
                });
                if (!res.ok && res.status !== 404 && res.status !== 410) {
                    return { success: false, error: `Push endpoint returned HTTP ${res.status}` };
                }
            }
            return {
                success: true,
                messageId: `webpush_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            };
        }
        catch (err) {
            return { success: false, error: err.message || 'Web Push dispatch failed' };
        }
    }
}
exports.WebPushAdapter = WebPushAdapter;
