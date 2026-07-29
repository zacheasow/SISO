# Milestone 11 — Local Offline Event Queue

- **Status:** Not started
- **Objective:** Harden the IndexedDB event store into a durable, append-only, crash-recoverable offline queue with a `synced` flag and idempotency keys.
- **Dependencies:** 10 (Student time in)

## Included work
- Event store schema in IndexedDB: `id`, `idempotencyKey`, `type`, `payload`, `clientTimestamp`, `originatingDevice`, `synced` (0/1), `syncAttempts`, `lastError`.
- Append-only semantics: events are inserted, never updated or deleted locally (except marking `synced`).
- Transactional write of session + event (already started in M10; formalized here).
- Queue enumeration: `getUnsyncedEvents()`, `markSynced(id, serverTimestamp)`, `recordSyncFailure(id, error)`.
- Crash recovery: on startup, any event with `synced=0` remains in the queue and is retried.
- Persistent sync state in `meta` store: last successful sync time, pending count.
- Unit tests for durability, append-only, and recovery.

## Explicitly excluded work
- No sync HTTP protocol (deferred to M12).
- No manual sync UI (deferred to M13).
- No automatic background sync worker (deferred to M12/M13).

## Expected files or directories
- `apps/check-in-pwa/src/db/event-queue.ts`
- `apps/check-in-pwa/src/db/sync-state.ts`
- `apps/check-in-pwa/src/__tests__/event-queue.test.ts`
- `apps/check-in-pwa/src/__tests__/sync-state.test.ts`

## Acceptance criteria
- Events are stored append-only; no update or delete of event records.
- `getUnsyncedEvents()` returns only events with `synced=0`.
- `markSynced` sets `synced=1` and records the server timestamp.
- After a simulated restart (re-open DB), unsynced events remain.
- Sync state persists across restarts.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Append-only enforcement.
- Queue persistence after restart (re-open DB).
- `markSynced` and `recordSyncFailure`.
- Sync state persistence.
- Idempotency key uniqueness in the queue.

## Manual verification steps
1. Create a check-in event, close the app, reopen, and confirm the event is still queued.
2. Mark an event synced and confirm it no longer appears in `getUnsyncedEvents`.

## Completion checklist
- [ ] Append-only event store
- [ ] `synced` flag and queue enumeration
- [ ] Sync state persistence
- [ ] Crash recovery verified
- [ ] Tests pass