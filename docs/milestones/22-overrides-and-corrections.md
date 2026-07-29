# Milestone 22 — Overrides and Corrections

- **Status:** Not started
- **Objective:** Add PIN-protected drop-off/pickup overrides and attendance corrections that preserve original events and require reasons.
- **Dependencies:** 21 (Student time out)

## Included work
- Drop-off override: when parent acknowledgment cannot be obtained, staff record a `DROPOFF_OVERRIDE` with shared staff PIN, required explanation, explicit confirmation, timestamp, device identifier, and audit-log entry. Never erases the fact that parent acknowledgment was not received.
- Pickup override: when the parent cannot use the link or internet is unavailable, staff complete a `PICKUP_OVERRIDE` with PIN, required reason, explicit confirmation, `student_time_out`, staff-side timestamp, checkout device ID, and audit-log entry.
- Attendance correction: staff correct a time or status by creating an `ATTENDANCE_CORRECTION` event that preserves the previous value, records the corrected value, requires PIN and correction reason, and records the correction timestamp. The original event is retained.
- Interface and reports clearly distinguish ordinary parent-acknowledged checkout from staff override.
- Validation: required override reason; required correction reason; PIN required.
- Unit and integration tests.

## Explicitly excluded work
- No named staff accounts (shared PIN only; design supports later extension).
- No reports (deferred to M24).

## Expected files or directories
- `apps/check-in-pwa/src/screens/override-screen.ts`
- `apps/check-in-pwa/src/flows/override.ts`
- `apps/local-server/src/routes/overrides.ts`
- `apps/local-server/src/attendance/corrections.ts`
- `apps/local-server/src/__tests__/overrides.test.ts`
- `apps/local-server/src/__tests__/corrections.test.ts`
- `apps/check-in-pwa/src/__tests__/override.test.ts`

## Acceptance criteria
- Drop-off override requires PIN, reason, and explicit confirmation; records `DROPOFF_OVERRIDE` and audit entry.
- Drop-off override does not erase the absence of parent acknowledgment.
- Pickup override requires PIN, reason, and explicit confirmation; records `PICKUP_OVERRIDE` and `student_time_out`.
- Attendance correction preserves the original event and records previous + corrected values with PIN and reason.
- Reports distinguish override from ordinary checkout.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Drop-off override with PIN and reason.
- Pickup override with PIN and reason.
- Required override reason (empty rejected).
- Attendance correction preserves original event.
- Correction requires PIN and reason.
- Override vs. ordinary checkout distinction.

## Manual verification steps
1. Check in a student without parent acknowledgment.
2. Perform a drop-off override with PIN and reason.
3. Perform a pickup override with PIN and reason.
4. Correct a time and confirm the original event is preserved.

## Completion checklist
- [ ] Drop-off override (PIN, reason, audit)
- [ ] Pickup override (PIN, reason, time out, audit)
- [ ] Attendance corrections (preserve original, PIN, reason)
- [ ] Override vs. ordinary distinction
- [ ] Tests pass