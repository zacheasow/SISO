export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS center_info (
  id INTEGER PRIMARY KEY DEFAULT 1,
  center_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#1E40AF',
  contact_phone TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/New_York',
  staff_pin_hash TEXT NOT NULL,
  early_checkin_window_mins INTEGER DEFAULT 30,
  late_checkin_window_mins INTEGER DEFAULT 60,
  backup_location TEXT,
  is_onboarded INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  student_name TEXT NOT NULL,
  parent1_phone TEXT NOT NULL,
  parent2_phone TEXT,
  qr_identifier TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  early_window_mins INTEGER DEFAULT 30,
  late_window_mins INTEGER DEFAULT 60,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  student_time_in DATETIME NOT NULL,
  student_time_out DATETIME,
  dropoff_ack_status TEXT DEFAULT 'NOT_SENT',
  dropoff_ack_time DATETIME,
  dropoff_ack_dest_phone_ref TEXT,
  pickup_ack_status TEXT DEFAULT 'NOT_REQUESTED',
  pickup_ack_time DATETIME,
  pickup_ack_dest_phone_ref TEXT,
  checkin_device_id TEXT NOT NULL,
  checkout_device_id TEXT,
  is_override INTEGER DEFAULT 0,
  override_type TEXT,
  override_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id TEXT PRIMARY KEY,
  attendance_session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  originating_device_id TEXT NOT NULL,
  client_timestamp DATETIME NOT NULL,
  server_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  idempotency_key TEXT UNIQUE NOT NULL,
  is_override INTEGER DEFAULT 0,
  override_reason TEXT,
  metadata TEXT,
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS secure_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  attendance_session_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  masked_phone_ref TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  is_revoked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paired_devices (
  id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  pairing_code TEXT,
  auth_token_hash TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  paired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME,
  last_sync_at DATETIME,
  pending_event_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sms_queue (
  id TEXT PRIMARY KEY,
  attendance_session_id TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_masked TEXT NOT NULL,
  parent_index INTEGER NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor_device_id TEXT,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high efficiency and filtering performance
CREATE INDEX IF NOT EXISTS idx_students_qr ON students(qr_identifier);
CREATE INDEX IF NOT EXISTS idx_students_sid ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timein ON attendance_sessions(student_time_in);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON attendance_events(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_events_idem ON attendance_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON secure_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_queue(status);
`;
