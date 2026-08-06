import { SmsAdapter, SmsSendResult } from './interface.js';
export declare class TelegramAdapter implements SmsAdapter {
    private botToken?;
    private defaultChatId?;
    name: string;
    constructor(botToken?: string | undefined, defaultChatId?: string | undefined);
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
