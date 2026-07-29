# Milestone 29 — Real SMS-Provider Adapter

- **Status:** Not started
- **Objective:** Add a Twilio SMS adapter with encrypted credential storage, credential validation, and test SMS so centers can send real SMS through their own provider account.
- **Dependencies:** 17 (SMS development outbox)

## Included work
- `TwilioAdapter` implementing `SmsAdapter` using the Twilio REST API.
- Encrypted credential storage on the main computer (AES-256-GCM); credentials never sent to check-in devices and never logged.
- Credential validation endpoint and test-SMS screen.
- Plain-language instructions and actionable errors.
- SMS-cost warnings (segment estimate).
- SMS-provider configuration screen in the desktop admin.
- The queue worker uses the configured adapter (dev outbox or Twilio).
- Unit and integration tests (mock Twilio API; no real sends in tests).

## Explicitly excluded work
- No distributor SMS credentials.
- No SMS hardware adapter (architecture stub only; deferred).
- No remote relay (deferred to M30).

## Expected files or directories
- `packages/sms/src/twilio.ts`
- `packages/sms/src/credential-store.ts`
- `packages/sms/src/__tests__/twilio.test.ts`
- `packages/sms/src/__tests__/credential-store.test.ts`
- `apps/local-server/src/routes/sms-config.ts`
- `apps/desktop-admin/src/screens/sms-config.ts`
- `apps/desktop-admin/src/__tests__/sms-config.test.ts`

## Acceptance criteria
- The Twilio adapter sends SMS via the Twilio API (mocked in tests).
- Credentials are encrypted at rest and never logged.
- Credential validation confirms credentials before saving.
- Test SMS sends a real message when credentials are valid.
- The queue worker uses the selected adapter.
- SMS-cost warnings are shown.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Twilio adapter send (mocked).
- Credential encryption/decryption round-trip.
- Credential validation.
- Adapter selection (dev vs. Twilio).
- No credentials in logs.

## Manual verification steps
1. Configure Twilio credentials in the desktop admin.
2. Send a test SMS to a real phone number.
3. Check in a student and confirm a real SMS is sent.

## Completion checklist
- [ ] Twilio adapter
- [ ] Encrypted credential storage
- [ ] Credential validation and test SMS
- [ ] SMS-provider configuration screen
- [ ] Adapter selection in queue worker
- [ ] Tests pass