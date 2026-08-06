import { EventType, DropoffAckStatus, PickupAckStatus, SmsStatus } from '../constants/index.js';

export interface CenterInfo {
  id: number;
  center_name: string;
  logo_url?: string;
  accent_color?: string;
  contact_phone: string;
  time_zone: string;
  staff_pin_hash: string;
  early_checkin_window_mins: number;
  late_checkin_window_mins: number;
  backup_location?: string;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string; // Internal UUID
  student_id: string; // School/Roster ID
  student_name: string;
  parent1_phone: string;
  parent2_phone?: string | null;
  qr_identifier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassItem {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface Schedule {
  id: string;
  class_id: string;
  day_of_week: number; // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string; // "15:00"
  end_time: string; // "18:00"
  early_window_mins: number;
  late_window_mins: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
}

export interface AttendanceSession {
  id: string;
  student_id: string;
  class_id: string;
  student_time_in: string;
  student_time_out?: string | null;
  dropoff_ack_status: DropoffAckStatus;
  dropoff_ack_time?: string | null;
  dropoff_ack_dest_phone_ref?: string | null;
  pickup_ack_status: PickupAckStatus;
  pickup_ack_time?: string | null;
  pickup_ack_dest_phone_ref?: string | null;
  checkin_device_id: string;
  checkout_device_id?: string | null;
  is_override: boolean;
  override_type?: string | null;
  override_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields optional
  student_name?: string;
  student_number?: string;
  class_name?: string;
}

export interface AttendanceEvent {
  id: string;
  attendance_session_id: string;
  event_type: EventType;
  originating_device_id: string;
  client_timestamp: string;
  server_timestamp: string;
  sync_timestamp?: string | null;
  idempotency_key: string;
  is_override: boolean;
  override_reason?: string | null;
  metadata?: Record<string, any> | string | null;
}

export interface PairedDevice {
  id: string;
  device_name: string;
  pairing_code?: string | null;
  auth_token_hash: string;
  is_active: boolean;
  paired_at: string;
  last_seen_at?: string | null;
  last_sync_at?: string | null;
  pending_event_count: number;
}

export interface SmsRecord {
  id: string;
  attendance_session_id: string;
  recipient_phone: string;
  recipient_masked: string;
  parent_index: number;
  message_body: string;
  status: SmsStatus;
  retry_count: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  actor_device_id?: string | null;
  details?: Record<string, any> | string | null;
  timestamp: string;
}

export interface SyncPayload {
  device_id: string;
  events: Array<{
    id: string;
    attendance_session_id: string;
    event_type: EventType;
    originating_device_id: string;
    client_timestamp: string;
    idempotency_key: string;
    student_id?: string;
    class_id?: string;
    is_override?: boolean;
    override_type?: string;
    override_reason?: string;
    metadata?: any;
  }>;
}

export interface SyncResponse {
  success: boolean;
  processed_event_ids: string[];
  acknowledged_count: number;
  errors: Array<{ event_id: string; error: string }>;
  server_timestamp: string;
}

export interface SystemConfig {
  cloudflare_tunnel_enabled: boolean;
  cloudflare_tunnel_url?: string;
  notification_provider: 'WEB_PUSH' | 'DEV_OUTBOX';
  vapid_public_key?: string;
  vapid_private_key?: string;
  vapid_subject?: string;
}
