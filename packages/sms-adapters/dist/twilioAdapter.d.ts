import { SmsAdapter, SmsSendResult } from './interface.js';
export declare class TwilioAdapter implements SmsAdapter {
    private accountSid;
    private authToken;
    private fromNumber;
    name: string;
    constructor(accountSid: string, authToken: string, fromNumber: string);
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
