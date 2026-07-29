# Milestone 26 — Device Pairing

- **Status:** Not started
- **Objective:** Add QR/short-code device pairing, device tokens, revocation, and a device management screen so check-in devices authenticate with the main computer.
- **Dependencies:** 12 (Main-computer synchronization API)

## Included work
- Desktop admin generates a 6-digit pairing code and QR encoding `https://<local-ip>:<port>/pair?code=<code>`.
- Check-in PWA pairing screen: scan QR, enter short code, or manual IP entry (advanced).
- `POST /pair` endpoint: validates code (hashed compare, rate-limited), creates `device` record, returns a device auth token.
- Device stores token in IndexedDB; sends `Authorization: Bearer` on all requests.
- Server stores `device_token_hash`; revocation sets `is_revoked` → next request gets 401.
- Desktop admin device list: device name, paired date, last-seen, last-sync, pending count, active/revoked. Rename + revoke.
- Audit events for pairing and revocation.
- Unit and integration tests.

## Explicitly excluded work
- No mDNS auto-discovery (browsers can't do raw UDP; manual IP/QR is the baseline).
- No automatic device re-pairing on restore (staff re-pair after a computer transfer).

## Expected files or directories
- `apps/local-server/src/routes/pair.ts`
- `apps/local-server/src/auth/device-auth.ts`
- `packages/database/src/device-queries.ts`
- `packages/database/src/__tests__/device-queries.test.ts`
- `apps/local-server/src/__tests__/pair.test.ts`
- `apps/check-in-pwa/src/screens/pairing-screen.ts`
- `apps/check-in-pwa/src/__tests__/pairing.test.ts`
- `apps/desktop-admin/src/screens/devices.ts`
- `apps/desktop-admin/src/__tests__/devices.test.ts`

## Acceptance criteria
- A device can pair via QR, short code, or manual IP.
- The server issues a device token; subsequent requests authenticate with it.
- Revoked devices receive 401 on the next request.
- The device list shows all required fields and supports rename/revoke.
- Pairing and revocation are audit-logged.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Device pairing via code.
- Device authentication on sync requests.
- Device revocation rejects future requests.
- Device list fields and rename.
- Audit events for pairing and revocation.

## Manual verification steps
1. Open the desktop admin device screen and generate a pairing code/QR.
2. Open the PWA pairing screen, scan the QR, and confirm pairing.
3. Perform a sync and confirm the device authenticates.
4. Revoke the device and confirm the next sync is rejected.

## Completion checklist
- [ ] Pairing code + QR generation
- [ ] PWA pairing screen (QR, code, manual IP)
- [ ] POST /pair with device token issuance
- [ ] Device auth on all requests
- [ ] Revocation
- [ ] Desktop device list (rename, revoke)
- [ ] Audit events
- [ ] Tests pass