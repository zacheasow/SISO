# Milestone 15 — Desktop Student Management

- **Status:** Not started
- **Objective:** Add desktop UI for viewing, editing, searching, and managing students, including QR identifier display and revocation/regeneration.
- **Dependencies:** 14 (Desktop application shell), 04 (Student data access)

## Included work
- Student list screen: paginated table with Student ID, name, masked phones, active status, QR status.
- Student search by name or Student ID.
- Student detail/edit screen: full phone numbers visible only here (protected), edit fields, active/inactive toggle.
- Create student form with validation.
- QR identifier display with download (PNG/SVG) and revoke/regenerate actions (audit-logged).
- PIN protection for create/edit/revoke/regenerate.
- Roster import entry point (links to M05 import flow with a file picker and mapping UI).
- Unit tests for the student management screens.

## Explicitly excluded work
- No class/schedule management UI (deferred to M16).
- No attendance views (deferred to later milestones).
- No QR-card PDF printing (deferred to M25).
- No onboarding wizard (deferred to M27).

## Expected files or directories
- `apps/desktop-admin/src/screens/students-list.ts`
- `apps/desktop-admin/src/screens/student-detail.ts`
- `apps/desktop-admin/src/screens/student-create.ts`
- `apps/desktop-admin/src/screens/roster-import.ts`
- `apps/desktop-admin/src/components/student-table.ts`
- `apps/desktop-admin/src/components/qr-card.ts`
- `apps/desktop-admin/src/__tests__/students-list.test.ts`
- `apps/desktop-admin/src/__tests__/student-detail.test.ts`

## Acceptance criteria
- The student list paginates and searches by name/ID.
- Phone numbers are masked in the list; full numbers only on the protected detail screen.
- Create/edit forms validate input and require PIN.
- QR identifier can be displayed, downloaded, revoked, and regenerated with audit logging.
- Roster import entry point opens the CSV import flow.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Student list pagination and search.
- Masked phones in list; full phones in detail.
- Create/edit validation and PIN requirement.
- QR revoke/regenerate audit logging.

## Manual verification steps
1. Open the desktop app, navigate to Students.
2. Search for a student and open the detail screen.
3. Edit a student and confirm the full phone number is visible.
4. Revoke and regenerate a QR identifier.

## Completion checklist
- [ ] Student list with pagination and search
- [ ] Student detail/edit (full phones, PIN-protected)
- [ ] Create student form
- [ ] QR display, download, revoke, regenerate
- [ ] Roster import entry point
- [ ] Tests pass