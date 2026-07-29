# Milestone 02 — Shared Types and Validation

- **Status:** Not started
- **Objective:** Define the cross-app TypeScript types, Zod schemas, enums, and phone-number helpers in `packages/shared` so all apps share one source of truth for data shapes.
- **Dependencies:** 01 (Project foundation)

## Included work
- Event type enum (`AttendanceEventType`) with all 14 spec-defined values.
- Drop-off and pickup acknowledgment status enums.
- SMS status enum (`PENDING`, `SENDING`, `SENT`, `FAILED`, `RETRYING`, `PERMANENTLY_FAILED`).
- Zod schemas for: `Student`, `Class`, `Schedule`, `Enrollment`, `AttendanceSession`, `AttendanceEvent`, `SecureToken`, `SmsMessage`, `Device`, `Center`, `StaffPin`, `AuditLog`, `ImportMapping`.
- Sync event envelope schema (`SyncEventEnvelope`) with `id`, `idempotencyKey`, `clientTimestamp`, `originatingDevice`, `payload`.
- Phone-number normalization helper (accept common formats, strip spaces/parens/hyphens, validate country code, normalize to E.164, configurable default country).
- Phone-number masking helper (`••• ••• 4567` format).
- Identical-parent-phone detection helper.
- Shared constants (e.g., token expiration defaults, sync batch size).
- Unit tests for all helpers and schemas.

## Explicitly excluded work
- No database code (deferred to M03).
- No HTTP routes (deferred to M04+).
- No UI components.
- No QR generation (deferred to M06).
- No SMS adapter implementation (deferred to M17).

## Expected files or directories
- `packages/shared/src/index.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/phone.ts`
- `packages/shared/src/sync-envelope.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/__tests__/phone.test.ts`
- `packages/shared/src/__tests__/schemas.test.ts`

## Acceptance criteria
- `packages/shared` builds with `tsup` and exports all types, schemas, enums, and helpers.
- Phone normalization handles the spec example numbers and rejects invalid input.
- Phone masking produces `••• ••• 4567` style output.
- Identical-parent detection returns true when Parent 1 and Parent 2 normalize to the same number.
- All Zod schemas parse valid input and reject invalid input in tests.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Phone normalization: valid formats, invalid numbers, blank Parent 2.
- Phone masking: produces masked output, never exposes full number.
- Identical-parent detection: same number, different numbers, blank Parent 2.
- Schema validation: each schema accepts valid and rejects invalid samples.
- Sync envelope: round-trips a sample event.

## Manual verification steps
1. Run `npm run build --workspace @kumon/shared`.
2. Run `npm run test --workspace @kumon/shared`.
3. Inspect exported types in the build output.

## Completion checklist
- [ ] Event type and status enums defined
- [ ] Zod schemas for all core entities
- [ ] Sync envelope schema
- [ ] Phone normalization + masking + identical detection helpers
- [ ] Shared constants
- [ ] Unit tests pass
- [ ] Package builds and exports correctly