# Milestone 10 — Student Time In

- **Status:** Not started
- **Objective:** Record `STUDENT_CHECKED_IN` locally and create an active attendance session when a student is identified, completing vertical slice 2.
- **Dependencies:** 08 (Current-class matching), 09 (Basic check-in interface)

## Included work
- Check-in flow: identify student → match current class → prevent second active session → create session + `STUDENT_CHECKED_IN` event in IndexedDB transactionally.
- Generate session UUID and event idempotency key on the device.
- Large success screen (student name, class, time in) and clear error screen.
- Return to scan screen after a configurable delay.
- Queue `SMS_QUEUED` events for Parent 1 and Parent 2 (if valid and different) — actual SMS sending deferred to M17.
- Show drop-off acknowledgment status (initially "Queued").
- Staff PIN override to select a non-matching class with a required reason (from M08).
- Server-side endpoint `POST /attendance/check-in` to accept a check-in event (used by sync later; here it can be called directly for testing).
- Unit and integration tests.

## Explicitly excluded work
- No offline queue durability hardening (deferred to M11).
- No sync to main computer (deferred to M12/M13).
- No parent acknowledgment page (deferred to M18+).
- No checkout (deferred to M21).
- No real SMS sending (deferred to M17/M29).

## Expected files or directories
- `apps/check-in-pwa/src/flows/check-in.ts`
- `apps/check-in-pwa/src/screens/success-screen.ts`
- `apps/check-in-pwa/src/screens/error-screen.ts`
- `apps/check-in-pwa/src/__tests__/check-in.test.ts`
- `apps/local-server/src/routes/attendance.ts`
- `apps/local-server/src/__tests__/attendance.routes.test.ts`
- `packages/database/src/attendance-queries.ts`
- `packages/database/src/__tests__/attendance-queries.test.ts`

## Acceptance criteria
- Scanning a student with a matching class records time in locally in under one second under normal conditions.
- A second active session for the same student is prevented.
- The success screen shows name, class, and time in.
- SMS queue events are created for Parent 1 and Parent 2 (when different).
- Drop-off ack status shows "Queued".
- Staff PIN override with reason works and is audit-logged.
- The server endpoint accepts and stores a check-in event.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Successful QR check-in.
- Duplicate scan prevention (second active session).
- Scheduled-class matching integration.
- Multiple matching classes selection.
- No matching class error.
- Schedule override (PIN + reason).
- Parent 1 and Parent 2 SMS queue events.
- Duplicate parent phone normalization (one SMS queued).
- Missing Parent 2 phone (one SMS queued).

## Manual verification steps
1. Load demo data with a student, class, and current schedule.
2. Open the PWA, scan the student's QR, and confirm the success screen.
3. Attempt to scan the same student again and confirm the duplicate is prevented.

## Completion checklist
- [ ] Check-in flow with class matching
- [ ] Duplicate active session prevention
- [ ] Session + event written transactionally to IndexedDB
- [ ] Success and error screens
- [ ] SMS queue events created
- [ ] Drop-off ack status display
- [ ] Staff PIN override
- [ ] Server endpoint
- [ ] Tests pass