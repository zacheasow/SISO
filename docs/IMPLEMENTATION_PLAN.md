# Implementation Plan

> Milestone-based implementation roadmap for the local-first student attendance system.
> Architecture: `docs/ARCHITECTURE.md`. Product spec: `docs/PRODUCT_SPEC.md`.
>
> Each milestone is sized to fit within one GLM 5.2 Free Cline task and must leave the project runnable.
> Status values: **Not started**, **In progress**, **Complete**, **Blocked**.

## Milestone index

| # | Milestone | File | Status | Dependencies | Objective |
|---|---|---|---|---|---|
| 01 | Project foundation | `docs/milestones/01-project-foundation.md` | Not started | — | Establish the npm-workspaces monorepo, TypeScript config, lint/format, and build scripts. |
| 02 | Shared types and validation | `docs/milestones/02-shared-types-and-validation.md` | Not started | 01 | Define cross-app TypeScript types, Zod schemas, enums, and phone helpers in `packages/shared`. |
| 03 | SQLite schema and migrations | `docs/milestones/03-sqlite-schema-and-migrations.md` | Not started | 01, 02 | Create `packages/database` with the full schema, migration runner, and demo-data generator. |
| 04 | Student data access | `docs/milestones/04-student-data-access.md` | Not started | 03 | Add typed student CRUD queries and a minimal local-server student API. |
| 05 | Roster CSV import | `docs/milestones/05-roster-csv-import.md` | Not started | 04 | Implement CSV parsing, column mapping, phone normalization, validation, and import endpoint. |
| 06 | QR-code generation | `docs/milestones/06-qr-code-generation.md` | Not started | 02 | Create `packages/qr` for opaque random IDs and QR image generation. |
| 07 | Classes, schedules, and enrollments | `docs/milestones/07-classes-schedules-enrollments.md` | Not started | 03 | Add class, schedule, and enrollment tables, queries, and admin API. |
| 08 | Current-class matching | `docs/milestones/08-current-class-matching.md` | Not started | 07 | Implement scheduled-class matching with time zones, windows, and DST handling. |
| 09 | Basic check-in interface | `docs/milestones/09-basic-check-in-interface.md` | Not started | 01, 02 | Scaffold the check-in PWA with service worker, IndexedDB layer, and scan/search screens. |
| 10 | Student time in | `docs/milestones/10-student-time-in.md` | Not started | 08, 09 | Record `STUDENT_CHECKED_IN` locally and create an active attendance session. |
| 11 | Local offline event queue | `docs/milestones/11-local-offline-event-queue.md` | Not started | 10 | Make the IndexedDB event store durable, append-only, and crash-recoverable. |
| 12 | Main-computer synchronization API | `docs/milestones/12-main-computer-sync-api.md` | Not started | 03, 11 | Add `POST /sync/events` and `GET /sync/roster` with idempotency and duplicate handling. |
| 13 | Manual Sync button | `docs/milestones/13-manual-sync-button.md` | Not started | 12 | Add the "Sync with main computer" UI with status, progress, and retry. |
| 14 | Desktop application shell | `docs/milestones/14-desktop-application-shell.md` | Not started | 01 | Scaffold the Tauri desktop shell that launches `local-server` as a sidecar. |
| 15 | Desktop student management | `docs/milestones/15-desktop-student-management.md` | Not started | 14, 04 | Add desktop UI for viewing, editing, and managing students. |
| 16 | Desktop schedule management | `docs/milestones/16-desktop-schedule-management.md` | Not started | 14, 07 | Add desktop UI for classes, schedules, and enrollments. |
| 17 | SMS development outbox | `docs/milestones/17-sms-development-outbox.md` | Not started | 02, 03 | Create `packages/sms` with the adapter interface and DevOutbox adapter plus queue logic. |
| 18 | Secure parent session | `docs/milestones/18-secure-parent-session.md` | Not started | 03, 10 | Generate and validate secure acknowledgment tokens with hashing and expiration. |
| 19 | Drop-off acknowledgment | `docs/milestones/19-drop-off-acknowledgment.md` | Not started | 18 | Add the parent drop-off acknowledgment page and `DROPOFF_ACKNOWLEDGED` event. |
| 20 | Pickup acknowledgment | `docs/milestones/20-pickup-acknowledgment.md` | Not started | 18, 19 | Add the parent pickup acknowledgment page and `PICKUP_ACKNOWLEDGED` event. |
| 21 | Student time out | `docs/milestones/21-student-time-out.md` | Not started | 10, 20 | Record `STUDENT_CHECKED_OUT` only on staff-confirmed checkout. |
| 22 | Overrides and corrections | `docs/milestones/22-overrides-and-corrections.md` | Not started | 21 | Add PIN-protected drop-off/pickup overrides and attendance corrections. |
| 23 | Audit log | `docs/milestones/23-audit-log.md` | Not started | 03 | Record and surface auditable actions for sensitive operations. |
| 24 | Attendance reports | `docs/milestones/24-attendance-reports.md` | Not started | 21 | Add reports, filters, CSV export, and two-year retention checks. |
| 25 | QR-card printing | `docs/milestones/25-qr-card-printing.md` | Not started | 06, 14 | Generate printable PDF QR cards with bulk/individual printing. |
| 26 | Device pairing | `docs/milestones/26-device-pairing.md` | Not started | 12 | Add QR/short-code device pairing, device tokens, and revocation. |
| 27 | Onboarding wizard | `docs/milestones/27-onboarding-wizard.md` | Not started | 14, 15, 16 | Build the 21-step first-run onboarding wizard with demo mode. |
| 28 | Professional UI and accessibility pass | `docs/milestones/28-professional-ui-and-accessibility.md` | Not started | 09, 14 | Apply the design system, accessibility, and low-powered-device polish. |
| 29 | Real SMS-provider adapter | `docs/milestones/29-real-sms-provider-adapter.md` | Not started | 17 | Add a Twilio adapter with encrypted credential storage and test SMS. |
| 30 | Optional center-owned remote relay | `docs/milestones/30-optional-center-owned-remote-relay.md` | Not started | 18, 19, 20 | Build the optional public HTTPS relay for parent acknowledgments. |
| 31 | Backup, restore, and computer transfer | `docs/milestones/31-backup-restore-transfer.md` | Not started | 03 | Add SQLite backup, rotation, encrypted backups, restore wizard, and transfer packages. |
| 32 | Installers and packaging | `docs/milestones/32-installers-and-packaging.md` | Not started | 14 | Produce Windows, macOS, and Linux installers and the installable PWA. |
| 33 | Security and performance audit | `docs/milestones/33-security-and-performance-audit.md` | Not started | All prior | Audit security, run performance checks, and fix findings. |
| 34 | Documentation and final acceptance testing | `docs/milestones/34-documentation-and-final-acceptance.md` | Not started | All prior | Complete operator/developer docs, E2E tests, and the manual acceptance checklist. |

## How to use this plan

1. Work on only one milestone at a time, in dependency order.
2. Before starting a milestone, read its file in `docs/milestones/`.
3. After completing a milestone, update its `Status` to **Complete** and update the table above.
4. If a milestone is blocked, set its `Status` to **Blocked** and note the blocker in its file.
5. Never begin a later milestone before the current one is complete (workspace rule).
6. Keep the project runnable after every milestone (workspace rule).

## Vertical slices

- **Slice 1 (by M05):** Import a CSV roster → see students with QR identifiers.
- **Slice 2 (by M10):** Check in a student via the PWA → see the attendance session.
- **Slice 3 (by M13):** Check in offline → sync to the main computer over Wi-Fi.
- **Slice 4 (by M21):** Full attendance loop: time in → drop-off ack → pickup ack → time out.