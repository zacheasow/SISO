# Milestone 27 — Onboarding Wizard

- **Status:** Not started
- **Objective:** Build the 21-step first-run onboarding wizard with demo mode so a nontechnical operator can set up the system without a terminal.
- **Dependencies:** 14 (Desktop application shell), 15 (Desktop student management), 16 (Desktop schedule management)

## Included work
- Onboarding wizard in the desktop app with the 21 steps from spec §17: welcome, center name, logo/branding, contact phone, time zone, staff PIN, attendance windows, drop-off/pickup rules, roster upload, column mapping, class/schedule import, import preview/validation, QR generation, QR-card test print, SMS-provider setup, test SMS, optional remote-link setup, backup-location selection, device pairing, end-to-end test, completion summary.
- SMS and internet-dependent steps can be skipped and completed later.
- Demo mode with fictional students and phone numbers.
- All onboarding settings remain editable in the desktop GUI.
- Progress persistence (resume after closing).
- Unit tests for the wizard flow.

## Explicitly excluded work
- No real SMS in onboarding (dev outbox test only; real SMS deferred to M29).
- No remote relay setup (deferred to M30; step is a placeholder/skip).

## Expected files or directories
- `apps/desktop-admin/src/onboarding/wizard.ts`
- `apps/desktop-admin/src/onboarding/steps/*.ts` (one per step)
- `apps/desktop-admin/src/onboarding/demo-data.ts`
- `apps/desktop-admin/src/__tests__/wizard.test.ts`

## Acceptance criteria
- A nontechnical operator can complete onboarding without a terminal.
- All 21 steps are present and functional (SMS/remote steps skippable).
- Demo mode loads fictional students and phone numbers.
- Settings are saved and editable later.
- Progress persists across app restarts.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Wizard step navigation.
- Settings persistence.
- Demo data loads correctly.
- Skippable steps do not block completion.

## Manual verification steps
1. Launch the desktop app on a fresh install.
2. Complete the onboarding wizard, skipping SMS and remote steps.
3. Confirm the dashboard shows the configured center and demo students.

## Completion checklist
- [ ] 21-step wizard
- [ ] Skippable SMS/remote steps
- [ ] Demo mode
- [ ] Settings persistence and editability
- [ ] Progress resume
- [ ] Tests pass