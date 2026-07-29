# Milestone 18 — Secure Parent Session

- **Status:** Not started
- **Objective:** Generate and validate secure acknowledgment tokens with SHA-256 hashing, expiration, one-time use, and revocation, providing the foundation for parent acknowledgment pages.
- **Dependencies:** 03 (SQLite schema and migrations), 10 (Student time in)

## Included work
- Token generation: cryptographically random token per session and action (drop-off, pickup).
- Token hashing: SHA-256 hash stored in `secure_token`; raw token never stored or logged.
- Token validation: hash match, not expired, not revoked, not used.
- Token expiration: expected session end plus configurable grace period.
- One-time use: `used_at` set on first valid action; reuse rejected.
- Revocation: `is_revoked` flag; revoked tokens rejected.
- Masked destination phone reference stored on the token.
- Separate action tokens for drop-off and pickup while keeping the parent experience simple.
- No PII in URL parameters (`https://<endpoint>/ack/<token>`).
- Unit tests for all token security cases.

## Explicitly excluded work
- No parent acknowledgment page UI (deferred to M19/M20).
- No SMS link inclusion (deferred to M19).
- No remote relay (deferred to M30).

## Expected files or directories
- `apps/local-server/src/auth/tokens.ts`
- `apps/local-server/src/routes/token.ts`
- `packages/database/src/token-queries.ts`
- `packages/database/src/__tests__/token-queries.test.ts`
- `apps/local-server/src/__tests__/tokens.test.ts`

## Acceptance criteria
- Tokens are cryptographically random and unique.
- Only the token hash is stored; raw tokens never appear in logs.
- Expired tokens are rejected.
- Reused tokens are rejected.
- Revoked tokens are rejected.
- One-time use is enforced per action.
- No PII is encoded in the token or URL.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Token generation uniqueness.
- Expired token rejected.
- Reused token rejected.
- Revoked token rejected.
- One-time use per action.
- Hash-only storage (no raw token in DB).

## Manual verification steps
1. Generate a token for a session and action.
2. Validate the token and confirm success.
3. Attempt to reuse the token and confirm rejection.

## Completion checklist
- [ ] Token generation and hashing
- [ ] Validation (expired, revoked, used)
- [ ] One-time use per action
- [ ] Masked destination storage
- [ ] No PII in URL
- [ ] Tests pass