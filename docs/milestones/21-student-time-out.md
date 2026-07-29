# Milestone 21 — Student Time Out

- **Status:** Not started
- **Objective:** Record `STUDENT_CHECKED_OUT` only on staff-confirmed checkout, completing vertical slice 4 (full attendance loop).
- **Dependencies:** 10 (Student time in), 20 (Pickup acknowledgment)

## Included work
- Staff checkout screen (check-in PWA and desktop admin): shows student name, ID, class, time in, drop-off ack status, pickup ack status, pickup ack time, masked parent phone (`••• ••• 4567`), sync status.
- **"Complete student checkout"** button.
- Records `STUDENT_CHECKED_OUT` event with `student_time_out`, staff-side timestamp, main-computer timestamp (when available), checkout device ID, whether parent pickup acknowledgment was present, whether an override was used.
- Duration = `student_time_out − student_time_in` (never uses pickup ack time).
- Validation: prevent time out before time in; prevent time out without an active session; prevent completing checkout twice.
- Session marked complete.
- Unit and integration tests.

## Explicitly excluded work
- No pickup override (deferred to M22).
- No drop-off override (deferred to M22).
- No attendance corrections (deferred to M22).
- No reports (deferred to M24).

## Expected files or directories
- `apps/check-in-pwa/src/screens/checkout-screen.ts`
- `apps/check-in-pwa/src/flows/checkout.ts`
- `apps/check-in-pwa/src/__tests__/checkout.test.ts`
- `apps/local-server/src/routes/attendance.ts` (extend with checkout endpoint)
- `apps/local-server/src/__tests__/checkout.routes.test.ts`
- `packages/database/src/attendance-queries.ts` (extend with checkout)

## Acceptance criteria
- The checkout screen displays all required fields with masked phone.
- "Complete student checkout" records `STUDENT_CHECKED_OUT` with `student_time_out`.
- Duration is calculated as time out minus time in.
- Time out before time in is rejected.
- Time out without an active session is rejected.
- Completing checkout twice is rejected.
- Pickup acknowledgment time is never used as time out.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Staff checkout sets time out.
- Pickup acknowledgment not setting time out (regression).
- Time out before time in rejected.
- Time out without active session rejected.
- Completing checkout twice rejected.
- Duration calculation correctness.

## Manual verification steps
1. Check in a student, acknowledge drop-off and pickup.
2. Open the checkout screen and confirm all fields are shown with masked phone.
3. Complete checkout and confirm time out is recorded and duration is correct.

## Completion checklist
- [ ] Checkout screen with all required fields
- [ ] "Complete student checkout" records `STUDENT_CHECKED_OUT`
- [ ] Duration = time out − time in
- [ ] Validation rules enforced
- [ ] Tests pass