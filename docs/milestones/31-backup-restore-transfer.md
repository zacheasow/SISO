# Milestone 31 — Backup, Restore, and Computer Transfer

- **Status:** Not started
- **Objective:** Add SQLite backup, rotation, encrypted backups, a restore wizard, and a transfer package so a center can back up and move its installation without distributor help.
- **Dependencies:** 03 (SQLite schema and migrations)

## Included work
- SQLite Online Backup API (`better-sqlite3.backup()`) for consistent snapshots — never copy a live DB file unsafely.
- Automatic daily backup to a configured location with rotation (keep N days).
- Manual backup button in the desktop admin.
- `PRAGMA integrity_check` before and after backup.
- Optional encrypted backup (AES-256-GCM, scrypt-derived key).
- Restore wizard: verify integrity → check schema version → run migrations if needed → restore.
- Transfer package: encrypted backup + manifest (app version, schema version, checksums) → USB → install on new computer → "Restore existing center" → import → verify → re-pair devices.
- Backup records stored in `backup_record`.
- PIN protection for backup and restore.
- Audit events for backup and restore.
- Unit and integration tests.

## Explicitly excluded work
- No cloud backup (local/USB only).
- No automatic transfer (staff-initiated).

## Expected files or directories
- `apps/local-server/src/backup/backup.ts`
- `apps/local-server/src/backup/restore.ts`
- `apps/local-server/src/backup/transfer-package.ts`
- `apps/local-server/src/routes/backup.ts`
- `apps/local-server/src/__tests__/backup.test.ts`
- `apps/local-server/src/__tests__/restore.test.ts`
- `apps/desktop-admin/src/screens/backup-restore.ts`
- `apps/desktop-admin/src/__tests__/backup-restore.test.ts`

## Acceptance criteria
- Backup produces a consistent SQLite snapshot with integrity check.
- Automatic daily backup runs with rotation.
- Encrypted backup encrypts and decrypts correctly.
- Restore wizard verifies integrity and schema version before restoring.
- Transfer package includes manifest with checksums and versions.
- A center can be moved to a new computer via USB without distributor help.
- Backup and restore require PIN and are audit-logged.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Backup and restore round-trip.
- Migration to another computer (transfer package).
- Integrity check before/after.
- Encrypted backup round-trip.
- Rotation keeps N backups.
- PIN protection and audit events.

## Manual verification steps
1. Create a backup in the desktop admin.
2. Restore it on a fresh install and confirm data is intact.
3. Create a transfer package, move it to another computer, and restore.

## Completion checklist
- [ ] SQLite backup API usage
- [ ] Automatic daily backup with rotation
- [ ] Manual backup
- [ ] Integrity checks
- [ ] Encrypted backup option
- [ ] Restore wizard
- [ ] Transfer package with manifest
- [ ] PIN protection and audit
- [ ] Tests pass