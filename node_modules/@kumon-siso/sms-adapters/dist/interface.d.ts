export interface SmsSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
export interface SmsAdapter {
    name: string;
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}
