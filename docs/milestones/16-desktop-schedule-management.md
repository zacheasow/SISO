# Milestone 16 — Desktop Schedule Management

- **Status:** Not started
- **Objective:** Add desktop UI for managing classes, schedules, and enrollments so staff can set up the weekly schedule and enroll students.
- **Dependencies:** 14 (Desktop application shell), 07 (Classes, schedules, and enrollments)

## Included work
- Class list screen with create/edit/deactivate.
- Schedule editor: recurring (day-of-week) and specific-date entries with start/end times, time zone, and early/late check-in windows.
- Enrollment editor: link students to classes with active date ranges; bulk enroll by class.
- PIN protection for all create/edit/delete actions.
- Validation with Zod schemas.
- Unit tests for the schedule management screens.

## Explicitly excluded work
- No current-class matching UI (logic exists from M08; no dedicated UI here).
- No attendance views (deferred to later milestones).
- No class/schedule CSV import (deferred to M27 onboarding).

## Expected files or directories
- `apps/desktop-admin/src/screens/classes-list.ts`
- `apps/desktop-admin/src/screens/class-detail.ts`
- `apps/desktop-admin/src/screens/schedule-editor.ts`
- `apps/desktop-admin/src/screens/enrollment-editor.ts`
- `apps/desktop-admin/src/components/class-table.ts`
- `apps/desktop-admin/src/components/schedule-form.ts`
- `apps/desktop-admin/src/__tests__/classes-list.test.ts`
- `apps/desktop-admin/src/__tests__/schedule-editor.test.ts`

## Acceptance criteria
- Classes can be created, edited, and deactivated.
- Schedules support recurring and specific-date entries with windows and time zone.
- Enrollments link students to classes with active ranges.
- All actions are PIN-protected.
- Validation rejects invalid input.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Class CRUD.
- Schedule recurring and specific-date creation.
- Enrollment creation and active-range enforcement.
- PIN protection.

## Manual verification steps
1. Open the desktop app, navigate to Classes.
2. Create a class, add a recurring schedule, and enroll students.
3. Confirm the schedule and enrollments appear.

## Completion checklist
- [ ] Class list and detail screens
- [ ] Schedule editor (recurring + specific-date)
- [ ] Enrollment editor with active ranges
- [ ] PIN protection
- [ ] Tests pass