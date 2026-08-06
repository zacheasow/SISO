export declare const EVENT_TYPES: {
    readonly STUDENT_CHECKED_IN: "STUDENT_CHECKED_IN";
    readonly DROPOFF_ACKNOWLEDGMENT_SENT: "DROPOFF_ACKNOWLEDGMENT_SENT";
    readonly DROPOFF_ACKNOWLEDGED: "DROPOFF_ACKNOWLEDGED";
    readonly DROPOFF_ACKNOWLEDGMENT_FAILED: "DROPOFF_ACKNOWLEDGMENT_FAILED";
    readonly PICKUP_REQUEST_SENT: "PICKUP_REQUEST_SENT";
    readonly PICKUP_ACKNOWLEDGED: "PICKUP_ACKNOWLEDGED";
    readonly PICKUP_ACKNOWLEDGMENT_FAILED: "PICKUP_ACKNOWLEDGMENT_FAILED";
    readonly STUDENT_CHECKED_OUT: "STUDENT_CHECKED_OUT";
    readonly DROPOFF_OVERRIDE: "DROPOFF_OVERRIDE";
    readonly PICKUP_OVERRIDE: "PICKUP_OVERRIDE";
    readonly ATTENDANCE_CORRECTION: "ATTENDANCE_CORRECTION";
    readonly SMS_QUEUED: "SMS_QUEUED";
    readonly SMS_SENT: "SMS_SENT";
    readonly SMS_FAILED: "SMS_FAILED";
};
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];
export declare const DROPOFF_ACK_STATUS: {
    readonly NOT_SENT: "NOT_SENT";
    readonly QUEUED: "QUEUED";
    readonly SENT: "SENT";
    readonly ACKNOWLEDGED: "ACKNOWLEDGED";
    readonly DELIVERY_FAILED: "DELIVERY_FAILED";
    readonly EXPIRED: "EXPIRED";
    readonly STAFF_OVERRIDE: "STAFF_OVERRIDE";
};
export type DropoffAckStatus = typeof DROPOFF_ACK_STATUS[keyof typeof DROPOFF_ACK_STATUS];
export declare const PICKUP_ACK_STATUS: {
    readonly NOT_REQUESTED: "NOT_REQUESTED";
    readonly LINK_SENT: "LINK_SENT";
    readonly PICKUP_REQUESTED: "PICKUP_REQUESTED";
    readonly APPROVED_FOR_RELEASE: "APPROVED_FOR_RELEASE";
    readonly COMPLETED: "COMPLETED";
    readonly DELIVERY_FAILED: "DELIVERY_FAILED";
    readonly EXPIRED: "EXPIRED";
    readonly STAFF_OVERRIDE: "STAFF_OVERRIDE";
};
export type PickupAckStatus = typeof PICKUP_ACK_STATUS[keyof typeof PICKUP_ACK_STATUS];
export declare const SMS_STATUS: {
    readonly PENDING: "PENDING";
    readonly SENDING: "SENDING";
    readonly SENT: "SENT";
    readonly FAILED: "FAILED";
    readonly PERMANENTLY_FAILED: "PERMANENTLY_FAILED";
};
export type SmsStatus = typeof SMS_STATUS[keyof typeof SMS_STATUS];
export declare const NOTIFICATION_PROVIDERS: {
    readonly WEB_PUSH: "WEB_PUSH";
    readonly DEV_OUTBOX: "DEV_OUTBOX";
};
export type NotificationProvider = typeof NOTIFICATION_PROVIDERS[keyof typeof NOTIFICATION_PROVIDERS];
