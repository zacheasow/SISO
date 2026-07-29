# Milestone 34 — Documentation and Final Acceptance Testing

- **Status:** Not started
- **Objective:** Complete operator/developer docs, E2E tests, and the manual acceptance checklist so the system meets the spec's end-to-end acceptance criteria.
- **Dependencies:** All prior milestones

## Included work
- Operator documentation (offline-bundled): installation, onboarding, roster import, QR generation/printing, device pairing, check-in, drop-off/pickup acknowledgment, checkout, manual sync, offline operation, SMS setup, remote links, corrections, backup, restore, moving computers, manual updates, troubleshooting, complete data export.
- Developer documentation: architecture, build, test, contribution, package structure.
- Troubleshooting guide.
- Privacy and security documentation (no legal compliance claims).
- E2E test suite (Playwright) covering the spec §36 acceptance scenario.
- Manual acceptance checklist (spec §36 steps).
- Fictional demo data finalized.
- CSV template finalized.
- Version information screen.

## Explicitly excluded work
- No new features.
- No auto-update from the internet.

## Expected files or directories
- `docs/operator/*.md` (all operator docs)
- `docs/developer/*.md` (developer docs)
- `docs/TROUBLESHOOTING.md`
- `docs/PRIVACY_AND_SECURITY.md`
- `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`
- `tests/e2e/acceptance.spec.ts`
- `scripts/finalize-demo-data.ts`

## Acceptance criteria
- All operator docs are present and offline-bundled.
- Developer docs explain architecture, build, and test.
- E2E test suite passes the spec §36 acceptance scenario.
- Manual acceptance checklist covers all 35 steps.
- Demo data and CSV template are finalized.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- E2E acceptance scenario (spec §36): install → onboard → import → QR → pair → check-in → SMS → drop-off ack → offline check-in → sync → pickup ack → checkout → override → history → CSV → backup → restore → move → second center independence.

## Manual verification steps
1. Follow the manual acceptance checklist end-to-end on a clean install.
2. Confirm all 35 steps pass.
3. Confirm a second center installs independently with no distributor dependency.

## Completion checklist
- [ ] Operator documentation (offline-bundled)
- [ ] Developer documentation
- [ ] Troubleshooting guide
- [ ] Privacy and security documentation
- [ ] E2E acceptance test suite passes
- [ ] Manual acceptance checklist
- [ ] Demo data finalized
- [ ] CSV template finalized
- [ ] Tests pass