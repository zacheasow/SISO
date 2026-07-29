# Milestone 08 — Current-Class Matching

- **Status:** Not started
- **Objective:** Implement scheduled-class matching so that when a student is scanned, the system finds the active class using the center time zone, early/late check-in windows, and DST handling.
- **Dependencies:** 07 (Classes, schedules, and enrollments)

## Included work
- `matchCurrentClass(studentId, now, centerTimeZone)` function in `packages/database` (or a shared scheduling module).
- Logic: find active enrollments for the student → compare with current schedule using center TZ → apply early/late windows → return matches.
- If exactly one class matches, select it automatically.
- If multiple classes match, return the list for staff selection.
- If no class matches, return a clear "no matching class" result.
- Daylight-saving transition handling (use a mature TZ library such as `Intl` API or a small, stable TZ helper).
- Device clock-skew detection: compare the device-reported time with the server time; warn if the difference exceeds a configurable threshold.
- Staff PIN override to select a non-matching class with a required reason (audit-logged).
- Unit tests covering DST, windows, multiple matches, no match, and clock skew.

## Explicitly excluded work
- No check-in UI (deferred to M09/M10).
- No attendance session creation (deferred to M10).
- No desktop UI (deferred to M16).

## Expected files or directories
- `packages/database/src/schedule-matching.ts`
- `packages/database/src/__tests__/schedule-matching.test.ts`
- `apps/local-server/src/routes/matching.ts` (optional endpoint for testing)
- `apps/local-server/src/__tests__/matching.routes.test.ts`

## Acceptance criteria
- A student enrolled in one class with a current-time schedule is auto-matched.
- A student enrolled in multiple overlapping classes returns a list.
- A student with no current schedule returns "no matching class".
- Early/late windows are respected.
- DST transitions are handled correctly (no off-by-one hour).
- Significant device clock skew produces a warning.
- Staff PIN override selects a non-matching class with a reason and audit event.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Scheduled-class matching: single match.
- Multiple matching classes.
- No matching class.
- Schedule override (PIN + reason).
- Time-zone handling.
- Daylight-saving transition.
- Device clock skew warning.

## Manual verification steps
1. Create a class with a schedule matching the current time and enroll a student.
2. Call the matching endpoint/function and confirm the class is selected.
3. Set a schedule outside the window and confirm "no matching class".

## Completion checklist
- [ ] `matchCurrentClass` implemented
- [ ] Single/multiple/none match cases
- [ ] Early/late window enforcement
- [ ] DST handling
- [ ] Clock-skew warning
- [ ] Staff PIN override with reason + audit
- [ ] Tests pass