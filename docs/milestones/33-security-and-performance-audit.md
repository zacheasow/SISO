# Milestone 33 — Security and Performance Audit

- **Status:** Not started
- **Objective:** Audit security, run performance checks on low-powered devices, and fix findings so the system meets the spec's security and performance requirements.
- **Dependencies:** All prior milestones

## Included work
- Security audit: parameterized queries everywhere, no raw token/PIN/credential/full-phone logging, token security (expired/reused/revoked), CSRF/replay protection, security headers, CSP, LAN-only bind, no public SQLite/admin exposure.
- Performance audit: small JS bundle size, no cloud fonts, minimal animations, efficient 1,000-student search, paginated history, fast startup, large touch targets, graceful slow-Wi-Fi operation.
- Fix findings discovered by the audit.
- Diagnostic export redaction verification.
- Threat model review and update.
- Unit and integration tests for fixes.

## Explicitly excluded work
- No new features; audit and fixes only.
- No E2E tests (deferred to M34).

## Expected files or directories
- `docs/THREAT_MODEL.md`
- `docs/SECURITY_AUDIT.md`
- `docs/PERFORMANCE_AUDIT.md`
- `tests/security-audit.test.ts`
- `tests/performance-audit.test.ts`
- Fixes across affected files as needed.

## Acceptance criteria
- No SQL injection vectors (all queries parameterized).
- No raw secrets in logs or diagnostics.
- Token security tests pass.
- Security headers and CSP are set.
- JS bundle is small (target defined in audit).
- 1,000-student search is fast (target defined in audit).
- No cloud font requests.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Security audit test suite (injection, logging, tokens, headers).
- Performance audit test suite (bundle size, search speed, startup).

## Manual verification steps
1. Run the security audit test suite and review the report.
2. Run the performance audit on a low-powered device or throttled browser.
3. Confirm all findings are fixed or documented as accepted limitations.

## Completion checklist
- [ ] Security audit complete and findings fixed
- [ ] Performance audit complete and findings fixed
- [ ] Threat model documented
- [ ] Diagnostic redaction verified
- [ ] Audit reports written
- [ ] Tests pass