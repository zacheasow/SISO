# Kumon SISO - Developer Documentation & Architecture Guide

Kumon SISO is architected as an offline-first TypeScript monorepo with 100% self-contained local operations.

---

## Workspace Structure
```
packages/
  ├── shared/           # Common TS interfaces, phone utils, crypto PIN hashing
  ├── database/         # SQLite migrations, DAO methods, backup/integrity tools
  ├── sms-adapters/     # Pluggable SMS adapters (Twilio, Dev Outbox)
  ├── import/           # Flexible CSV parser, column header matching, validation
  ├── qr/               # QR code generator and PDF print sheet layout engine
  └── sync/             # Idempotent event sync protocol and conflict resolver
apps/
  ├── local-server/     # Fastify REST API backend running SQLite database
  ├── check-in-pwa/     # Vite + TS PWA client with IndexedDB offline queue
  ├── desktop-admin/    # Vite + React GUI desktop administration console
  └── optional-parent-relay/ # Mobile parent drop-off / pickup ack web server
```

---

## Build & Test Commands

```bash
# Build all packages and applications
npm run build

# Run comprehensive Vitest automated test suite
npm test

# Start local server
npm run start:server
```
