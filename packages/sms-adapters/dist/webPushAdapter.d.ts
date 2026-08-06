import { SmsAdapter, SmsSendResult } from './interface.js';
export declare class WebPushAdapter implements SmsAdapter {
    private vapidPublicKey?;
    private vapidPrivateKey?;
    private vapidSubject;
    name: string;
    constructor(vapidPublicKey?: string | undefined, vapidPrivateKey?: string | undefined, vapidSubject?: string);
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
