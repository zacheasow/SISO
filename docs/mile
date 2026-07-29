# Milestone 07 — Classes, Schedules, and Enrollments

- **Status:** Not started
- **Objective:** Add class, schedule, and enrollment tables, queries, and admin API so the system can model scheduled classes and which students attend them.
- **Dependencies:** 03 (SQLite schema and migrations)

## Included work
- Class query module: `createClass`, `getClass`, `listClasses`, `updateClass`, `deactivateClass`.
- Schedule query module: `createSchedule`, `listSchedulesForClass`, `updateSchedule`, `deleteSchedule`. Supports both recurring (`day_of_week`) and specific-date schedules with start/end times, time zone, and early/late check-in windows.
- Enrollment query module: `createEnrollment`, `listEnrollmentsForStudent`, `listEnrollmentsForClass`, `updateEnrollment`, `deactivateEnrollment` with active date ranges.
- Admin API routes (PIN-protected): `GET/POST/PUT/DELETE /classes`, `GET/POST/PUT/DELETE /classes/:id/schedules`, `GET/POST/PUT/DELETE /enrollments`.
- Input validation with Zod schemas.
- Unit and integration tests.

## Explicitly excluded work
- No current-class matching logic (deferred to M08).
- No desktop UI for schedule management (deferred to M16).
- No attendance logic (deferred to M10).
- No import of classes/schedules (deferred to M16/M27).

## Expected files or directories
- `packages/database/src/class-queries.ts`
- `packages/database/src/schedule-queries.ts`
- `packages/database/src/enrollment-queries.ts`
- `packages/database/src/__tests__/class-queries.test.ts`
- `packages/database/src/__tests__/schedule-queries.test.ts`
- `packages/database/src/__tests__/enrollment-queries.test.ts`
- `apps/local-server/src/routes/classes.ts`
- `apps/local-server/src/routes/schedules.ts`
- `apps/local-server/src/routes/enrollments.ts`
- `apps/local-server/src/__tests__/classes.routes.test.ts`

## Acceptance criteria
- Class CRUD endpoints work with valid/invalid input.
- Schedule supports recurring (day-of-week) and specific-date entries with time zone and check-in windows.
- Enrollment links students to classes with active date ranges.
- All endpoints are PIN-protected.
- All queries are parameterized.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Class create/read/update/list/deactivate.
- Schedule create for recurring and specific-date; update; delete.
- Enrollment create/list-by-student/list-by-class; active range enforcement.
- Invalid class assignment rejected.
- PIN protection on all endpoints.

## Manual verification steps
1. Start `local-server`.
2. Create a class, add a recurring schedule, and enroll a student.
3. List enrollments for the student and confirm the class appears.

## Completion checklist
- [ ] Class query module and routes
- [ ] Schedule query module and routes (recurring + specific-date)
- [ ] Enrollment query module and routes (active ranges)
- [ ] PIN protection on all endpoints
- [ ] Tests pass