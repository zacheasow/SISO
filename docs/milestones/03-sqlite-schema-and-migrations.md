# Milestone 03 — SQLite Schema and Migrations

- **Status:** Not started
- **Objective:** Create `packages/database` with the full SQLite schema, a migration runner, WAL mode, foreign keys, indexes, and a demo-data generator.
- **Dependencies:** 01 (Project foundation), 02 (Shared types and validation)

## Included work
- Add `better-sqlite3` dependency to `packages/database`.
- Migration runner reading numbered SQL files from `packages/database/migrations/` and recording applied versions in `schema_migrations`.
- Initial migration (`001_init.sql`) creating all tables from the architecture document: `center`, `student`, `class`, `schedule`, `enrollment`, `attendance_session`, `attendance_event`, `secure_token`, `sms_message`, `device`, `staff_pin`, `audit_log`, `import_mapping`, `backup_record`, `schema_migrations`.
- Enable WAL mode and foreign keys (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`).
- Indexes as specified in the architecture document.
- Typed query helper module with parameterized queries (no string interpolation).
- Transaction helper.
- `PRAGMA integrity_check` helper.
- Demo-data generator script (`scripts/generate-demo-data.ts`) that creates a center, fictional students with masked phone numbers, classes, schedules, and enrollments.
- Unit tests for migrations and queries using a temporary in-memory or temp-file database.

## Explicitly excluded work
- No HTTP API (deferred to M04).
- No student CRUD endpoints (deferred to M04).
- No attendance logic (deferred to M10).
- No UI.
- No argon2 hashing (deferred to M04 for staff PIN).

## Expected files or directories
- `packages/database/package.json`
- `packages/database/src/index.ts`
- `packages/database/src/migrate.ts`
- `packages/database/src/queries.ts`
- `packages/database/src/transactions.ts`
- `packages/database/src/integrity.ts`
- `packages/database/migrations/001_init.sql`
- `scripts/generate-demo-data.ts`
- `packages/database/src/__tests__/migrate.test.ts`
- `packages/database/src/__tests__/queries.test.ts`

## Acceptance criteria
- Running migrations on a fresh database creates all tables without error.
- Re-running migrations is a no-op (idempotent).
- WAL mode and foreign keys are enabled after migration.
- `PRAGMA integrity_check` returns `ok` after migration.
- Inserting a student with a duplicate `student_id` fails.
- Inserting an enrollment with a nonexistent `student_id` fails (FK enforcement).
- Demo-data generator produces a valid database with fictional students.
- All queries are parameterized (no SQL injection vectors).
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Migration creates all tables.
- Migration is idempotent on re-run.
- Foreign key enforcement rejects orphan rows.
- Unique constraints reject duplicates (`student_id`, `qr_identifier`, `idempotency_key`, `token_hash`).
- Integrity check returns `ok`.
- Demo-data generator produces expected row counts.

## Manual verification steps
1. Run `npm run build --workspace @kumon/database`.
2. Run `npm run test --workspace @kumon/database`.
3. Run `npm run generate-demo-data` and inspect the resulting SQLite file with a SQLite browser if available.

## Completion checklist
- [ ] `better-sqlite3` added
- [ ] Migration runner implemented
- [ ] `001_init.sql` with all tables, indexes, WAL, FKs
- [ ] Typed query helpers (parameterized)
- [ ] Transaction and integrity helpers
- [ ] Demo-data generator
- [ ] Migration and query tests pass