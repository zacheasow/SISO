# Milestone 04 — Student Data Access

- **Status:** Not started
- **Objective:** Add typed student CRUD queries and a minimal local-server student API, plus staff PIN set/verify with argon2id hashing.
- **Dependencies:** 03 (SQLite schema and migrations)

## Included work
- Student query module in `packages/database`: `createStudent`, `getStudentById`, `getStudentByStudentId`, `getStudentByQrIdentifier`, `listStudents` (paginated), `updateStudent`, `deactivateStudent`, `searchStudentsByName`.
- All student queries use parameterized statements and return typed `Student` objects from `packages/shared`.
- Staff PIN module in `packages/database`: `setStaffPin` (argon2id hash), `verifyStaffPin`, `rateLimitFailedAttempts`, `lockAfterFailures`.
- Add `argon2` (or `@node-rs/argon2`) dependency.
- `apps/local-server` Fastify skeleton: health check (`GET /health`), center CRUD (`GET/PUT /center`), student CRUD endpoints (`GET /students`, `GET /students/:id`, `POST /students`, `PUT /students/:id`, `DELETE /students/:id` with soft-delete/active flag).
- PIN-protected endpoints require `X-Staff-Pin` header verified via `verifyStaffPin`.
- Input validation with Zod schemas from `packages/shared`.
- Phone normalization on write; masked phone on read (full number only on the protected student-edit endpoint).
- LAN bind configuration (default all interfaces; configurable host/port).
- Unit tests for student queries and PIN hashing; integration tests for the Fastify routes.

## Explicitly excluded work
- No CSV import (deferred to M05).
- No QR generation (deferred to M06).
- No classes/schedules/enrollments API (deferred to M07).
- No attendance logic (deferred to M10).
- No sync API (deferred to M12).
- No desktop UI (deferred to M14+).

## Expected files or directories
- `packages/database/src/student-queries.ts`
- `packages/database/src/staff-pin.ts`
- `packages/database/src/__tests__/student-queries.test.ts`
- `packages/database/src/__tests__/staff-pin.test.ts`
- `apps/local-server/package.json`
- `apps/local-server/src/index.ts`
- `apps/local-server/src/routes/health.ts`
- `apps/local-server/src/routes/center.ts`
- `apps/local-server/src/routes/students.ts`
- `apps/local-server/src/auth/pin.ts`
- `apps/local-server/src/__tests__/students.routes.test.ts`

## Acceptance criteria
- Student CRUD endpoints work over HTTP with valid/invalid input.
- PIN-protected endpoints reject requests without a valid PIN.
- Staff PIN is stored as an argon2id hash; plaintext is never stored or logged.
- Failed PIN attempts are rate-limited.
- Phone numbers are normalized on write and masked on list/read endpoints.
- The protected student-edit endpoint returns the full phone number.
- `local-server` binds to the LAN and reports its LAN IP via `GET /health`.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Student create/read/update/list/search with valid data.
- Duplicate `student_id` rejected.
- Invalid phone rejected.
- PIN set and verify (correct and incorrect).
- PIN rate-limiting after repeated failures.
- Route tests: unauthenticated rejected, authenticated succeeds.
- Phone masking on list endpoint; full number on edit endpoint.

## Manual verification steps
1. Run `npm run dev --workspace @kumon/local-server`.
2. `curl http://localhost:<port>/health` returns status and LAN IP.
3. Create a student via `POST /students` with a valid PIN.
4. List students and confirm phone numbers are masked.
5. Edit a student and confirm the full phone number is returned.

## Completion checklist
- [ ] Student query module (parameterized, typed)
- [ ] Staff PIN module (argon2id, rate-limit)
- [ ] Fastify skeleton with health, center, student routes
- [ ] PIN-protected endpoints
- [ ] Phone normalization on write, masking on read
- [ ] LAN bind + IP reporting
- [ ] Unit and route tests pass