# Milestone 06 — QR-Code Generation

- **Status:** Not started
- **Objective:** Create `packages/qr` for opaque cryptographically random identifier generation and QR image generation, and wire it into student creation so every student has a unique QR identifier.
- **Dependencies:** 02 (Shared types and validation)

## Included work
- `packages/qr` module: `generateQrIdentifier()` using `crypto.randomBytes(32)` → base64url; `generateQrImage(identifier, options)` producing PNG/SVG via `qrcode`.
- Uniqueness guarantee (retry on collision, checked against the database).
- Integration with student creation: when a student is created (via API or import), generate and assign a `qr_identifier` if none is provided.
- QR revocation and regeneration endpoints: `POST /students/:id/qr/revoke`, `POST /students/:id/qr/regenerate`. Revocation sets `qr_identifier_revoked_at` and issues a new identifier; both are audit-logged.
- Rejected revoked codes fail immediately on lookup (`getStudentByQrIdentifier` returns inactive/revoked).
- Individual QR-image download endpoint: `GET /students/:id/qr.png` and `GET /students/:id/qr.svg`.
- No PII encoded in the QR value (only the opaque identifier).
- Unit and integration tests.

## Explicitly excluded work
- No QR scanning (deferred to M09).
- No QR-card PDF printing (deferred to M25).
- No bulk ZIP download (deferred to M25).
- No desktop UI for QR management (deferred to M15).

## Expected files or directories
- `packages/qr/package.json`
- `packages/qr/src/index.ts`
- `packages/qr/src/identifier.ts`
- `packages/qr/src/image.ts`
- `packages/qr/src/__tests__/identifier.test.ts`
- `packages/qr/src/__tests__/image.test.ts`
- `apps/local-server/src/routes/qr.ts`
- `apps/local-server/src/__tests__/qr.routes.test.ts`

## Acceptance criteria
- `generateQrIdentifier()` produces a unique, opaque, URL-safe string with no PII.
- Creating a student without a QR identifier assigns one automatically.
- QR revocation sets `qr_identifier_revoked_at` and issues a new identifier.
- A revoked identifier is rejected on lookup.
- QR revocation and regeneration are audit-logged.
- QR image endpoints return valid PNG and SVG.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Identifier uniqueness over many generations.
- Identifier contains no PII (no student ID, name, phone).
- Automatic assignment on student creation.
- Revocation rejects old identifier.
- Regeneration issues a new identifier.
- Revocation and regeneration create audit events.
- Image generation produces valid PNG/SVG bytes.

## Manual verification steps
1. Create a student and confirm a `qr_identifier` is assigned.
2. Download the QR PNG and scan it with a phone to confirm it encodes only the opaque identifier.
3. Revoke and regenerate the QR and confirm the old identifier is rejected.

## Completion checklist
- [ ] `packages/qr` with identifier and image generation
- [ ] Automatic QR assignment on student creation
- [ ] Revocation and regeneration endpoints
- [ ] Audit logging for revocation/regeneration
- [ ] QR image download endpoints
- [ ] Tests pass