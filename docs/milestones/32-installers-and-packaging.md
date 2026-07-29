# Milestone 32 — Installers and Packaging

- **Status:** Not started
- **Objective:** Produce Windows, macOS, and Linux installers and the installable PWA so a nontechnical operator can install without terminal, Docker, or Git.
- **Dependencies:** 14 (Desktop application shell)

## Included work
- Tauri build configuration for Windows (`.msi`/`.exe`), macOS (`.dmg`/`.app`), and Linux (AppImage).
- Installers create required folders, initialize SQLite, generate unique secrets, start the local service through the desktop application, preserve data during upgrades, and warn before data removal.
- Installable PWA configuration (web manifest + service worker) for the check-in app.
- Manual offline update mechanism: database migrations, pre-update backup, version checks, rollback instructions.
- Release build scripts in `scripts/`.
- Lockfiles included; mature, stable dependencies.
- No Node.js, Git, Docker, compiler tools, terminal use, or manual database setup required by operators.

## Explicitly excluded work
- No auto-update from the internet (manual offline updates only).
- No app store distribution (direct download).
- No Android wrapper (deferred to a later optional milestone).

## Expected files or directories
- `apps/desktop-admin/src-tauri/tauri.conf.json` (build config)
- `scripts/build-release.ts`
- `scripts/package-windows.ts`
- `scripts/package-macos.ts`
- `scripts/package-linux.ts`
- `docs/installation.md`
- `docs/manual-updates.md`

## Acceptance criteria
- `tauri build` produces installers for the current platform.
- The installer creates folders, initializes SQLite, and generates secrets.
- Data is preserved during upgrades.
- The PWA is installable via "Add to Home Screen."
- Manual offline update instructions are documented.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Build script produces expected artifacts (smoke test).
- Installer config validation.

## Manual verification steps
1. Run the release build script for the current platform.
2. Install the produced artifact on a clean machine.
3. Confirm the app launches, initializes SQLite, and runs.

## Completion checklist
- [ ] Tauri build config for Windows, macOS, Linux
- [ ] Installer creates folders, initializes DB, generates secrets
- [ ] Data preservation on upgrade
- [ ] Installable PWA
- [ ] Manual offline update docs
- [ ] Release build scripts
- [ ] Tests pass