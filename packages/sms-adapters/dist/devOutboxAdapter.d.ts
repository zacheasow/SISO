import { SmsAdapter, SmsSendResult } from './interface.js';
export declare class DevOutboxAdapter implements SmsAdapter {
    name: string;
    private outboxPath;
    constructor(outboxDir?: string);
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
