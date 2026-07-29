# Architecture

> Authoritative architecture document for the local-first student attendance and pickup system.
> Product specification: `docs/PRODUCT_SPEC.md`.
> Implementation roadmap: `docs/IMPLEMENTATION_PLAN.md`.

## 1. Goals and constraints

The system is a **local-first student check-in, parent-acknowledgment, pickup, and checkout** application distributed once to independent educational or community centers. Each center installs, configures, operates, backs up, and troubleshoots its own copy with no dependence on the original distributor.

Hard constraints (from `docs/PRODUCT_SPEC.md` and workspace rules):

- Local-first: attendance records even when internet, the main computer, or SMS service are unavailable.
- SQLite is the authoritative database. No spreadsheet as the transactional store.
- The check-in application and the desktop administration application are separate products.
- Student roster fields are limited to: Student ID, Student name, Parent 1 phone, Parent 2 phone.
- Phone numbers and SMS only. Never email.
- No personal information inside QR codes.
- No distributor-controlled services, telemetry, licensing, or shared infrastructure.
- Optimized for low-powered devices (older Android tablets, cheap Chromebooks).
- Every center installation is independent. One center must not know another exists.
- The project must remain runnable after every milestone.

## 2. Final technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript (strict) everywhere | Shared types across all apps and packages; spec-mandated. |
| Check-in PWA UI | Vanilla TypeScript + Web Components | Spec: "Avoid React unless there is a compelling measured reason. Prefer lightweight HTML, CSS, and TypeScript." Zero framework runtime weight. |
| Check-in offline storage | IndexedDB (thin repository layer) | Spec-mandated durable storage for low-powered devices. |
| Desktop admin shell | Tauri (Rust webview) | Spec-preferred over Electron; small native binaries and installers. |
| Desktop admin UI | Vanilla TypeScript + Web Components | Consistent with the PWA; no framework weight. |
| Local backend | Node.js + Fastify | Spec-suggested; lightweight, mature, TypeScript-native. |
| Database | SQLite via `better-sqlite3` | Synchronous, fast, mature; spec-mandated authoritative store. |
| QR scanning | `@zxing/browser` (fallback `jsQR`) | Spec-suggested; lightweight, no cloud calls. |
| QR generation | `qrcode` + `crypto.randomBytes` | Opaque cryptographically random identifiers; no PII. |
| Runtime validation | Zod | Spec asks for "shared runtime validation schemas"; small and mature. |
| SMS | Pluggable `SmsAdapter` interface; DevOutbox first, Twilio later | Spec-mandated modular provider interface. |
| PDF (QR cards) | `pdfkit` | Mature, local-only, no cloud. |
| Tests | Vitest (unit/integration); Playwright added late for E2E | Fast, TypeScript-native. |
| Build / monorepo | npm workspaces + tsup | Minimal tooling; no extra orchestration weight. |
| Password hashing | argon2id (via `@node-rs/argon2` or `argon2`) | Strong, modern KDF for staff PINs. |
| Token hashing | SHA-256 | Fast, sufficient for short-lived opaque tokens. |
| Backup encryption | AES-256-GCM + scrypt-derived key | Optional encrypted backups and transfer packages. |

Explicitly rejected: React/Preact (spec says avoid; vanilla is lighter), Electron (heavier than Tauri), cloud-hosted fonts, analytics, any distributor-owned service, Docker, email/SMTP.

## 3. Monorepo structure

```
apps/
  check-in-pwa/       # Vanilla TS PWA — offline-first check-in
  desktop-admin/      # Tauri shell — launches local-server, renders admin UI
  local-server/       # Node + Fastify — SQLite, sync API, admin API, parent pages
  parent-relay/       # OPTIONAL (later) — center-owned public ack endpoint
packages/
  shared/             # Types, Zod schemas, enums, phone normalize/mask, sync envelope
  database/           # Schema, migrations, typed queries (better-sqlite3)
  qr/                 # Opaque ID generation + QR encode/decode helpers
  sms/                # SmsAdapter interface + DevOutbox adapter
docs/                 # PRODUCT_SPEC.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, milestones/
scripts/              # Build, demo-data, release helpers
tests/                # Cross-app integration and E2E tests
```

Consolidation notes: sync logic lives in `shared` (types/envelope) plus `local-server` (server) and `check-in-pwa` (client). Import logic lives in `local-server` plus `shared` (schemas). UI components are per-app because the two UIs are deliberately different. There is no separate `ui`, `import`, or `sync` package.

## 4. Component responsibilities

### `apps/check-in-pwa`
Fast attendance actions only. Screens: QR scanning, manual student search, successful check-in, check-in error, current class information, parent drop-off acknowledgment status, pending pickup requests, staff checkout, staff override, current connectivity, pending synchronization count, manual synchronization, device pairing, limited diagnostics. Offline-first via IndexedDB and a service worker. Optimized for low-powered touch devices. Never shows administration, configuration, or reports.

### `apps/desktop-admin` (Tauri)
Setup, administration, reports, printing, configuration, backups, and troubleshooting. Launches `local-server` as a sidecar process so it feels like one application to the operator. Never shows the check-in scan screen. Provides first-run onboarding, student management, class/schedule/enrollment management, roster import, QR generation and printing, current attendance, attendance history, manual corrections, reports and exports, SMS status, device pairing and sync status, staff PIN management, center branding, SMS-provider configuration, remote parent-link configuration, backup and restore, audit log, diagnostics, offline documentation, and version information.

### `apps/local-server`
The single backend. Owns SQLite. Serves:
- Sync API for paired check-in devices (`POST /sync/events`, `GET /sync/roster`).
- Admin API for the desktop UI.
- Parent acknowledgment pages in local-only mode.
- Static files for the check-in PWA.

Binds to the LAN by default (all interfaces, configurable) so check-in devices on the center Wi-Fi can reach it. The admin UI displays the current LAN IP(s) so staff know what address to pair devices against.

### `apps/parent-relay` (optional, later)
A small Node.js application the center deploys on its own VPS, cloud host, or tunnel. Receives parent acknowledgment requests over public HTTPS. Stores only minimal token metadata (hashes, session references) and is never the authoritative attendance database. Forwards acknowledgments to `local-server` when reachable and queues them if the center's internet is down, replaying later. The distributor never owns or operates this endpoint.

### `packages/shared`
Cross-app TypeScript types, Zod schemas, event-type enums, status enums, phone-number normalization and masking helpers, and the sync event envelope shape.

### `packages/database`
Schema definitions, the migration runner, typed query helpers, transactions, and integrity checks. All queries are parameterized.

### `packages/qr`
Cryptographically random opaque identifier generation, QR PNG/SVG generation, and revocation/regeneration helpers. No PII is ever encoded.

### `packages/sms`
The `SmsAdapter` interface and the `DevOutboxAdapter` (writes to the `sms_message` table or a local file for development and demo mode). Later milestones add a Twilio adapter and an architecture stub for compatible SMS hardware.

## 5. Database architecture

SQLite is the authoritative local database. WAL mode is enabled. Foreign keys are ON. All queries are parameterized. A `schema_migrations` table tracks applied migrations. All timestamps are `INTEGER` (Unix milliseconds). Phone numbers are stored normalized to E.164; masked variants are stored for display and logs.

### Tables

- **`center`** (single row): `id, name, logo_path, accent_color, contact_phone, time_zone, default_country_code, attendance_settings(JSON), sms_settings(JSON, encrypted credentials), retention_settings(JSON), created_at, updated_at`.
- **`student`**: `id(UUID PK), student_id(unique, not null), name(not null), parent1_phone(not null), parent2_phone(nullable), qr_identifier(unique, not null), qr_identifier_revoked_at(nullable), is_active, created_at, updated_at`. Indexes on `student_id` and `qr_identifier`.
- **`class`**: `id(UUID PK), name, description, is_active, created_at, updated_at`.
- **`schedule`**: `id(UUID PK), class_id(FK), day_of_week(0-6, nullable), specific_date(nullable), start_time, end_time, time_zone, early_check_in_min, late_check_in_min, created_at, updated_at`.
- **`enrollment`**: `id(UUID PK), student_id(FK), class_id(FK), active_from, active_until(nullable), is_active, created_at, updated_at`. Index on `(student_id, class_id)`.
- **`attendance_session`**: `id(UUID PK), student_id(FK), class_id(FK), student_time_in, student_time_out(nullable), dropoff_ack_status, dropoff_ack_timestamp(nullable), dropoff_ack_phone_ref(masked), pickup_ack_status, pickup_ack_timestamp(nullable), pickup_ack_phone_ref(masked), checkin_device_id, checkout_device_id(nullable), override_flag, override_type(nullable), override_reason(nullable), created_at, updated_at`. Indexes on `(student_id, student_time_in)` and `(class_id, student_time_in)`.
- **`attendance_event`** (append-only): `id(UUID PK), session_id(FK), event_type, originating_device, client_timestamp, server_timestamp(nullable), sync_timestamp(nullable), idempotency_key(unique), override_flag, override_reason(nullable), metadata(JSON), created_at`. Indexes on `session_id` and `idempotency_key`.
- **`secure_token`**: `id(UUID PK), token_hash(SHA-256, unique), session_id(FK), action_type(DROPOFF|PICKUP), created_at, expires_at, used_at(nullable), is_revoked, masked_destination`.
- **`sms_message`**: `id(UUID PK), session_id(FK, nullable), to_phone(normalized), to_phone_masked, body, status, provider_message_id(nullable), attempts, last_error(nullable), queued_at, sent_at(nullable), next_retry_at(nullable)`.
- **`device`**: `id(UUID PK), name, pairing_code_hash(nullable), device_token_hash, paired_at, last_seen_at, last_sync_at, pending_event_count, is_active, is_revoked`.
- **`staff_pin`**: `id(PK), pin_hash(argon2id), is_active, created_at, updated_at`. Single shared PIN now; designed to extend to named staff accounts without rewriting attendance.
- **`audit_log`**: `id(UUID PK), action, actor, target(nullable), details(JSON, redacted), created_at`. Indexes on `created_at` and `action`.
- **`import_mapping`**: `id(PK), name, mapping(JSON), created_at`.
- **`backup_record`**: `id(PK), path, checksum, size, created_at, schema_version, app_version`.
- **`schema_migrations`**: `version(PK), applied_at`.

### Event types

Attendance is stored as auditable, append-only events (spec §8):

- `STUDENT_CHECKED_IN`
- `DROPOFF_ACKNOWLEDGMENT_SENT`
- `DROPOFF_ACKNOWLEDGED`
- `DROPOFF_ACKNOWLEDGMENT_FAILED`
- `PICKUP_REQUEST_SENT`
- `PICKUP_ACKNOWLEDGED`
- `PICKUP_ACKNOWLEDGMENT_FAILED`
- `STUDENT_CHECKED_OUT`
- `DROPOFF_OVERRIDE`
- `PICKUP_OVERRIDE`
- `ATTENDANCE_CORRECTION`
- `SMS_QUEUED`
- `SMS_SENT`
- `SMS_FAILED`

The `attendance_session` row is a materialized view of the latest events for a session. Events are never overwritten or deleted. Corrections create an `ATTENDANCE_CORRECTION` event that preserves the previous and corrected values; the original event is retained.

## 6. Online and offline data flow

### Online (Wi-Fi LAN reachable)

```
Tablet ──Wi-Fi──> Center router ──LAN──> Main computer (local-server + SQLite)
```

1. The check-in device records attendance locally in IndexedDB (always, regardless of connectivity).
2. A background sync worker pushes queued events to `local-server` over the Wi-Fi LAN.
3. `local-server` writes events to SQLite in a transaction and returns server timestamps.
4. The device marks events synced only after the server acknowledges receipt.
5. The device pulls incremental roster/schedule updates via `GET /sync/roster?since=<version>`.

### Offline (Wi-Fi/LAN unreachable, internet down, or main computer off)

1. The check-in device records attendance locally in IndexedDB. The student is checked in the instant this local write succeeds.
2. Events remain in the persistent queue with `synced=false`.
3. The UI shows "Attendance saved locally and will sync later" and the pending count.
4. SMS and remote parent links cannot work without internet; the UI communicates this clearly without blocking local attendance.
5. When connectivity returns, the background sync worker resumes with exponential backoff and jitter. The manual "Sync with main computer" button is always available.

Attendance recording never waits for SMS delivery, parent acknowledgment, internet access, main-computer availability, or synchronization (spec §4, §12).

## 7. Synchronization design

### Persistent queue
The check-in device's IndexedDB store is the queue. Each event has a `synced` flag. Unsynchronized events are the pending queue. Events are never deleted before the server acknowledges receipt (spec §12).

### Protocol (HTTP over LAN, JSON)
- `POST /sync/events`: the device sends a batch of events with idempotency keys. The server processes each in a transaction. If an `idempotency_key` already exists, the server returns the prior result without creating a duplicate. The response includes per-event `server_timestamp`.
- `GET /sync/roster?since=<version>`: incremental pull of students, classes, schedules, enrollments, and device configuration.

### Idempotency and duplicates
Every event carries a client-generated UUID and a client-generated idempotency key. Re-sending an unsynced event after a crash or partial sync is safe: the server recognizes the idempotency key and returns the original result. No duplicates are created.

### Retry and backoff
Automatic retries use exponential backoff with jitter. The queue persists across application restarts and device sleep. The manual sync button shows: number of records waiting, last successful sync time, whether the main computer is reachable, current progress, and a success/partial/failure result (spec §13). Repeated taps are disabled while syncing. Failed records are preserved and inspectable; staff can retry.

### Conflict handling
Events are append-only, so conflicts are rare. Session status is derived from the latest events for a session. Duplicate drop-off or pickup acknowledgments are rejected (first valid acknowledgment wins). Duplicate synchronization events are deduplicated by idempotency key.

### Crash recovery
IndexedDB writes are transactional. A partial sync resumes by re-sending unsynced events, which is safe because of idempotency. A server crash during sync leaves the device's queue intact; the next sync retries.

## 8. Parent acknowledgment design

### Secure tokens
- A cryptographically secure token is generated for each attendance session and action (drop-off, pickup).
- The **token hash** (SHA-256) is stored in `secure_token`; the raw token never appears in logs or the database in plaintext.
- No personal data is placed in URL parameters. The link is `https://<endpoint>/ack/<token>`.
- Tokens expire after the expected session end plus a configurable grace period.
- Each action is independently idempotent: drop-off acknowledgment allowed once, pickup request allowed once.
- `GET` requests never complete actions. Link-preview bots receive a no-op response. Known crawler user-agents are detected and served a safe page without side effects.
- Completed sessions become read-only or expire. Revoking the session revokes access.
- CSRF and replay protection are enforced. HTTPS is mandatory for public pages.

### Drop-off acknowledgment
1. The check-in SMS contains a link to the secure page.
2. The parent opens the link: a minimal-JS, mobile-friendly page loads (center name, student name, class, time in).
3. The parent presses **"Acknowledge drop-off"** and explicitly confirms.
4. `POST /ack` with the token and action validates the token (hash match, not expired, not revoked, not used) and records a `DROPOFF_ACKNOWLEDGED` event plus the session status, timestamp, and masked phone reference.
5. If both parents received links, the first valid acknowledgment completes the drop-off acknowledgment. The other link then shows that drop-off has already been acknowledged.
6. The student remains checked in even if acknowledgment is delayed, SMS fails, or no parent responds.

### Pickup acknowledgment
1. The parent opens the session link and presses **"I am picking up this student"** and confirms.
2. `POST /ack` with the pickup action records a `PICKUP_ACKNOWLEDGED` event and the pickup status/timestamp.
3. Staff see a pending pickup request. The student remains checked in. Pickup acknowledgment does not by itself prove the student physically left.

### Local-only vs. remote mode
- **Local-only mode** (default): the acknowledgment page is hosted on `local-server` and reachable by parents on the center Wi-Fi. Parents outside the LAN cannot reach it. SMS may include a local link or omit the link. Staff PIN overrides cover the gap when parents cannot use the link.
- **Remote mode** (optional, later): the center configures its own relay (`apps/parent-relay`) so parents outside the LAN can open acknowledgment links over the public internet. The distributor never owns this endpoint.

## 9. SMS architecture

- `packages/sms` defines `SmsAdapter.sendSms({to, body}): Promise<{messageId, status}>`.
- Adapters are added incrementally:
  - `DevOutboxAdapter`: writes to the `sms_message` table or a local file. Used for development and demo mode.
  - `TwilioAdapter`: a real provider, added in a later milestone.
  - `SmsHardwareAdapter`: an architecture stub for compatible USB SMS hardware, added later.
- SMS credentials are encrypted at rest on the main computer only. They are never sent to check-in devices and never logged.
- The SMS queue lives in the `sms_message` table. A local-server worker processes the queue with retries. Status transitions: `PENDING → SENDING → SENT | FAILED → RETRYING → PERMANENTLY_FAILED`.
- At check-in, SMS is queued for Parent 1 and for Parent 2 if the number is valid, present, and different after normalization. If both normalize to the same number, only one SMS is sent.
- Staff can retry failed SMS from the desktop admin GUI. Check-in succeeds even when SMS fails (spec §21).
- SMS is optional. Core attendance works without it.

## 10. Security model

### Authentication and authorization
- The initial version uses a shared staff PIN. The PIN is hashed with argon2id; plaintext is never stored.
- Failed PIN attempts are rate-limited and locked after repeated failures. Administrative access locks after inactivity.
- PIN is not required for ordinary scans. PIN is required for overrides, corrections, imports, exports, settings, and backups.
- The design supports adding named staff accounts later without rewriting the attendance system.
- Check-in devices authenticate with a device token issued at pairing. The token hash is stored server-side; revocation invalidates the token.

### Token security
- Acknowledgment tokens are cryptographically random, hashed at rest, one-time use, expiring, and revocable.
- No PII in URLs. GET never acts. Link previews are safe. CSRF and replay protection enforced.

### Data protection
- Parent phone numbers are masked in normal screens, reports, logs, and diagnostics. Full numbers are visible only in the protected student-editing screen.
- No personal data in QR values. QR identifiers are opaque random values.
- SMS credentials encrypted at rest. Raw tokens, PINs, credentials, and full phone numbers are never logged.
- Diagnostic exports redact student names, full phone numbers, PINs, credentials, raw tokens, encryption keys, and attendance records.

### Network security
- `local-server` binds to the LAN only by default. SQLite, desktop administration, local diagnostics, student search, reports, and backups are never exposed publicly.
- Only parent acknowledgment endpoints may be public, and only via the optional center-owned relay over HTTPS.
- HTTPS is mandatory for public traffic. Restrictive security headers, CSP, input validation, parameterized queries, and XSS/CSRF protections are enforced.

### Audit
Sensitive actions are recorded in the `audit_log`: PIN attempts, imports, configuration changes, QR revocation/regeneration, manual corrections, overrides, parent acknowledgments, token use, SMS failures, device pairing/revocation, backups, restores, and exports. Attendance corrections and overrides always require audit events (workspace security rule).

## 11. Cross-platform packaging approach

### Check-in PWA
Served by `local-server`. Installable on Android, iOS, Windows, macOS, Linux, and Chromebooks via the browser "Add to Home Screen" flow. A service worker provides offline support. A web manifest provides installability. Progressive enhancement: essential attendance functions work on older devices; camera scanning is used when supported; manual search and ID entry always remain available; external USB/Bluetooth keyboard scanners always work.

### Optional Android wrapper (later)
A Capacitor wrapper around the PWA provides reliable camera access on older Android versions where the browser camera API is unreliable.

### Desktop admin (Tauri)
- Windows: `.msi` / `.exe` installer.
- macOS: `.dmg` / `.app`.
- Linux: AppImage.
- Tauri bundles the admin UI and launches `local-server` as a sidecar process.
- Installers create required folders, initialize SQLite, generate unique secrets, start the local service through the desktop application, preserve data during upgrades, and warn before data removal. No Node.js, Git, Docker, compiler tools, terminal use, or manual database setup is required by operators (spec §31).
- Manual offline updates include database migrations, a pre-update backup, version checks, and rollback instructions.

## 12. Important limitations

1. **Public parent links require a center-owned endpoint.** A parent outside the center's Wi-Fi cannot access a page hosted only on the local computer. Remote mode requires the center to deploy its own relay, VPS, cloud host, or tunnel. The distributor never owns this. This limitation is not hidden.
2. **Real SMS requires a center-owned provider account.** The application does not use distributor SMS credentials. Each center configures and pays for its own provider. SMS is optional; core attendance works without it.
3. **mDNS auto-discovery is limited in browsers.** Browsers cannot perform raw UDP/mDNS. Device pairing uses QR codes, short pairing codes, and manual IP entry as the reliable baseline. HTTP-based discovery on a known port is a possible later enhancement.
4. **XLSX import is deferred.** CSV is supported first. XLSX is added only if it does not add excessive weight (spec §18).
5. **Shared staff PIN, not named accounts.** The initial version uses a shared PIN. The schema is designed to add named staff accounts later without rewriting attendance.
6. **No biometrics, facial recognition, advertising, or tracking** (spec §33).
7. **No legal compliance claims.** Centers must evaluate privacy obligations under applicable student-record and child-privacy rules (spec §33).
8. **Low-powered-device constraints.** The PWA avoids frameworks, cloud fonts, analytics, and unnecessary scripts. Camera scanning has manual fallbacks. History is paginated. These constraints shape the UI architecture throughout.