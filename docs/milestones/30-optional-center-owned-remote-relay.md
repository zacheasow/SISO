# Milestone 30 — Optional Center-Owned Remote Relay

- **Status:** Not started
- **Objective:** Build the optional public HTTPS relay so parents outside the center Wi-Fi can open acknowledgment links, with the distributor never owning the endpoint.
- **Dependencies:** 18 (Secure parent session), 19 (Drop-off acknowledgment), 20 (Pickup acknowledgment)

## Included work
- `apps/parent-relay` small Node.js app the center deploys on its own VPS/cloud/tunnel.
- Public HTTPS endpoint receiving parent acknowledgment requests.
- Stores minimal token metadata (hashes, session references) — never the authoritative attendance database.
- Forwards acknowledgments to `local-server` when reachable; queues if the center's internet is down and replays later.
- Center configures relay URL + shared secret in the desktop admin.
- SMS includes the public link when remote mode is enabled.
- Only parent-ack endpoints are public. SQLite, admin, search, reports, and backups are never exposed.
- HTTPS is mandatory.
- Unit and integration tests.

## Explicitly excluded work
- No distributor-operated relay.
- No automatic relay provisioning (center deploys it manually).
- No multi-center relay (one relay per center).

## Expected files or directories
- `apps/parent-relay/package.json`
- `apps/parent-relay/src/index.ts`
- `apps/parent-relay/src/forwarder.ts`
- `apps/parent-relay/src/queue.ts`
- `apps/parent-relay/src/__tests__/forwarder.test.ts`
- `apps/parent-relay/src/__tests__/queue.test.ts`
- `apps/local-server/src/routes/relay-config.ts`
- `apps/desktop-admin/src/screens/relay-config.ts`

## Acceptance criteria
- The relay serves parent acknowledgment pages over public HTTPS.
- Acknowledgments are forwarded to `local-server` when reachable.
- Acknowledgments are queued and replayed when the center's internet is down.
- Only ack endpoints are public; no other endpoints are exposed.
- The distributor never owns or operates the relay.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Acknowledgment forwarding.
- Queue and replay when center is unreachable.
- No non-ack endpoints exposed.
- Shared secret authentication between relay and local-server.

## Manual verification steps
1. Deploy the relay on a test host.
2. Configure the relay URL in the desktop admin.
3. Open an acknowledgment link from outside the center network and confirm it works.

## Completion checklist
- [ ] Relay app with public HTTPS ack endpoint
- [ ] Forwarding to local-server
- [ ] Queue and replay on center outage
- [ ] Center-owned configuration
- [ ] Only ack endpoints public
- [ ] Tests pass