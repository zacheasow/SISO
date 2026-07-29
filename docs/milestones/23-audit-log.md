# Milestone 23 — Audit Log

- **Status:** Not started
- **Objective:** Record and surface auditable actions for sensitive operations so the system maintains a tamper-evident history.
- **Dependencies:** 03 (SQLite schema and migrations)

## Included work
- Audit log query module: `recordAuditEvent`, `listAuditEvents` (paginated, filtered by action/actor/date range).
- Record auditable actions: PIN attempts, imports, configuration changes, QR revocation/regeneration, manual corrections, overrides, parent acknowledgments, token use, SMS failures, device pairing/revocation, backups, restores, exports.
- Audit details are redacted (no raw tokens, PINs, credentials, full phone numbers).
- Desktop admin audit log screen: filterable, paginated table.
- PIN protection for viewing the audit log.
- Unit and integration tests.

## Explicitly excluded work
- No tamper-evident chaining (e.g., hash chains) beyond append-only storage; append-only is sufficient for v1.
- No export of the audit log (deferred to M24 reports/exports).

## Expected files or directories
- `packages/database/src/audit-queries.ts`
- `packages/database/src/__tests__/audit-queries.test.ts`
- `apps/local-server/src/routes/audit.ts`
- `apps/local-server/src/__tests__/audit.routes.test.ts`
- `apps/desktop-admin/src/screens/audit-log.ts`
- `apps/desktop-admin/src/__tests__/audit-log.test.ts`

## Acceptance criteria
- All sensitive actions create an audit event.
- Audit details are redacted (no secrets, full phones, tokens, PINs).
- The audit log screen is filterable and paginated.
- Viewing the audit log requires PIN.
- Audit events are append-only (no update/delete).
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Audit event creation for each sensitive action type.
- Redaction of secrets in details.
- Append-only enforcement.
- Filter and pagination.

## Manual verification steps
1. Perform several sensitive actions (override, correction, import, backup).
2. Open the audit log screen and confirm the actions appear with redacted details.

## Completion checklist
- [ ] Audit query module (record + list)
- [ ] All sensitive actions audited
- [ ] Redaction of secrets
- [ ] Desktop audit log screen (filter, paginate, PIN)
- [ ] Append-only enforcement
- [ ] Tests pass