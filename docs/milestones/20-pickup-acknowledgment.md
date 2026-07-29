# Milestone 20 — Pickup Acknowledgment

- **Status:** Not started
- **Objective:** Add the parent pickup acknowledgment page and `PICKUP_ACKNOWLEDGED` event, with staff visibility of pending pickup requests and the rule that pickup acknowledgment does not set time out.
- **Dependencies:** 18 (Secure parent session), 19 (Drop-off acknowledgment)

## Included work
- Parent-facing pickup acknowledgment page (same session link or pickup-specific token): "I acknowledge that I am requesting pickup of this student."
- **"I am picking up this student"** button with explicit confirmation.
- `POST /ack` with pickup action: validates token, records `PICKUP_ACKNOWLEDGED` event, updates pickup status/timestamp/masked phone ref.
- Pickup request allowed once (one-time use).
- Staff sees pending pickup requests in the check-in PWA and desktop admin.
- The student remains checked in after pickup acknowledgment (pickup ack ≠ time out).
- Expired/completed links show a clear explanation.
- Link-preview safety and GET-never-acts (reuse from M19).
- Unit and integration tests.

## Explicitly excluded work
- No student time out / checkout (deferred to M21).
- No pickup override (deferred to M22).
- No remote relay (deferred to M30).

## Expected files or directories
- `apps/local-server/src/parent/pickup-page.ts`
- `apps/local-server/src/routes/ack.ts` (extend with pickup action)
- `apps/local-server/src/__tests__/pickup-ack.test.ts`
- `apps/check-in-pwa/src/screens/pending-pickups.ts`
- `apps/check-in-pwa/src/__tests__/pending-pickups.test.ts`

## Acceptance criteria
- The pickup page shows the pickup statement and button.
- Pressing "I am picking up this student" with confirmation records the event.
- Pickup acknowledgment is allowed once; duplicate requests are rejected.
- Staff see pending pickup requests.
- The student remains checked in after pickup acknowledgment.
- Pickup acknowledgment time is recorded separately from time in and does not set time out.
- Expired/completed links show a clear explanation.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Pickup acknowledgment success.
- Duplicate pickup acknowledgment rejected.
- Pickup acknowledgment does not set time out.
- Expired/reused/revoked token rejected.
- Pending pickup request visibility for staff.

## Manual verification steps
1. Check in a student and acknowledge drop-off.
2. Open the pickup link and press "I am picking up this student."
3. Confirm the pending pickup request appears for staff and the student is still checked in.

## Completion checklist
- [ ] Pickup acknowledgment page
- [ ] POST /ack pickup action
- [ ] One-time use enforcement
- [ ] Pending pickup requests visible to staff
- [ ] Pickup ack does not set time out
- [ ] Tests pass