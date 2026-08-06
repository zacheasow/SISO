import { SmsAdapter, SmsSendResult } from './interface.js';
import { SystemConfig } from '@kumon-siso/shared';
export declare class NotificationDispatcher implements SmsAdapter {
    private config;
    private outboxDir;
    name: string;
    constructor(config: SystemConfig, outboxDir?: string);
    getAdapter(): SmsAdapter;
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
