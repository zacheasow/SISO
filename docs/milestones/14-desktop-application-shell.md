# Milestone 14 — Desktop Application Shell

- **Status:** Not started
- **Objective:** Scaffold the Tauri desktop shell that launches `local-server` as a sidecar and renders the admin UI, so the desktop application feels like one normal application.
- **Dependencies:** 01 (Project foundation)

## Included work
- `apps/desktop-admin` Tauri project scaffold (Rust + webview).
- Sidecar configuration to launch `local-server` on app start and stop it on exit.
- Admin UI shell in vanilla TypeScript + Web Components: top-level navigation, dashboard placeholder, and a settings screen for the server address/port.
- Display the current LAN IP(s) from `local-server` so staff know the pairing address.
- First-run detection: if no center is configured, show a placeholder prompting onboarding (full onboarding deferred to M27).
- Build scripts for development (`tauri dev`) and production (`tauri build`).
- No terminal, Docker, Git, or manual DB setup required to run.
- Unit tests for the shell navigation; manual verification of sidecar launch.

## Explicitly excluded work
- No full onboarding wizard (deferred to M27).
- No student/schedule management UI (deferred to M15/M16).
- No reports, backups, or diagnostics UI (deferred to later milestones).
- No installers (deferred to M32).

## Expected files or directories
- `apps/desktop-admin/package.json`
- `apps/desktop-admin/src-tauri/tauri.conf.json`
- `apps/desktop-admin/src-tauri/src/main.rs`
- `apps/desktop-admin/src-tauri/Cargo.toml`
- `apps/desktop-admin/src/index.html`
- `apps/desktop-admin/src/main.ts`
- `apps/desktop-admin/src/shell/navigation.ts`
- `apps/desktop-admin/src/screens/dashboard.ts`
- `apps/desktop-admin/src/screens/settings.ts`
- `apps/desktop-admin/src/__tests__/navigation.test.ts`

## Acceptance criteria
- `tauri dev` launches the desktop app and starts `local-server` as a sidecar.
- The admin UI loads and shows navigation and a dashboard placeholder.
- The settings screen shows the server address/port and current LAN IP(s).
- Closing the app stops the sidecar.
- First-run detection shows a placeholder when no center is configured.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Navigation between placeholder screens.
- First-run detection logic.

## Manual verification steps
1. Run `npm run dev --workspace @kumon/desktop-admin` (or `tauri dev`).
2. Confirm the desktop window opens and `local-server` is running.
3. Open the settings screen and confirm the LAN IP is displayed.
4. Close the app and confirm the sidecar stops.

## Completion checklist
- [ ] Tauri project scaffold
- [ ] Sidecar launch/stop for `local-server`
- [ ] Admin UI shell with navigation
- [ ] Dashboard and settings placeholders
- [ ] LAN IP display
- [ ] First-run detection
- [ ] Tests pass