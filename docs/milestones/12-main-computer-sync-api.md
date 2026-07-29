# Milestone 12 — Main-Computer Synchronization API

- **Status:** Not started
- **Objective:** Add the server-side sync endpoints `POST /sync/events` and `GET /sync/roster` with idempotency, duplicate handling, and server acknowledgments.
- **Dependencies:** 03 (SQLite schema and migrations), 11 (Local offline event queue)

## Included work
- `POST /sync/events`: accepts a batch of event envelopes. For each, checks `idempotency_key`; if present, returns the prior result; otherwise inserts the event in a transaction and returns `server_timestamp`.
- `GET /sync/roster?since=<version>`: returns incremental updates to students, classes, schedules, enrollments, and device configuration since a version cursor.
- Device authentication: requests must include a valid device token (from M26 pairing; until then, a dev/test token is acceptable).
- Server records `server_timestamp` and `sync_timestamp` on accepted events.
- Never deletes unsynced events before ack (server-side: events are append-only).
- Duplicate synchronization attempt returns the original result without side effects.
- Unit and integration tests including server-crash-during-sync simulation.

## Explicitly excluded work
- No manual sync UI (deferred to M13).
- No automatic background sync worker on the device (deferred to M13).
- No device pairing UI (deferred to M26); a dev token is used for testing.

## Expected files or directories
- `apps/local-server/src/routes/sync.ts`
- `apps/local-server/src/sync/apply-event.ts`
- `apps/local-server/src/sync/roster-export.ts`
- `apps/local-server/src/__tests__/sync.events.test.ts`
- `apps/local-server/src/__tests__/sync.roster.test.ts`

## Acceptance criteria
- `POST /sync/events` accepts a batch and returns per-event results with `server_timestamp`.
- A duplicate event (same `idempotency_key`) returns the original result without creating a duplicate.
- `GET /sync/roster` returns incremental updates since a version.
- Device authentication is enforced (invalid token rejected).
- Events are stored append-only; no overwrites.
- A simulated server crash mid-batch leaves already-processed events intact and unprocessed events retryable.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Manual synchronization (push a batch).
- Automatic synchronization (push multiple batches).
- Duplicate synchronization attempt (same idempotency key).
- Server crash during sync (partial batch).
- Roster incremental pull.
- Device authentication rejection.

## Manual verification steps
1. Start `local-server`.
2. `POST /sync/events` with a batch of check-in events and confirm per-event results.
3. Re-post the same batch and confirm no duplicates.
4. `GET /sync/roster?since=0` and confirm roster data.

## Completion checklist
- [ ] `POST /sync/events` with idempotency
- [ ] `GET /sync/roster` incremental pull
- [ ] Device authentication
- [ ] Server timestamps recorded
- [ ] Duplicate handling
- [ ] Crash-during-sync test
- [ ] Tests pass