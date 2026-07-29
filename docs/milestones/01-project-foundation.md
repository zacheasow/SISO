# Milestone 01 — Project Foundation

- **Status:** Not started
- **Objective:** Establish the npm-workspaces monorepo, strict TypeScript configuration, lint/format, and build scripts so every later milestone has a stable foundation.
- **Dependencies:** None

## Included work
- Root `package.json` with npm workspaces pointing to `apps/*` and `packages/*`.
- Root `tsconfig.base.json` with strict TypeScript settings shared by all packages.
- ESLint and Prettier configuration with minimal, stable rules.
- `tsup` as the build tool for packages.
- Root scripts: `build`, `lint`, `format`, `typecheck`, `test`.
- `.gitignore` for `node_modules`, `dist`, build artifacts, and local SQLite files.
- `packages/shared`, `packages/database`, `packages/qr`, `packages/sms` package skeletons with `package.json` and empty `src/index.ts`.
- `apps/check-in-pwa`, `apps/desktop-admin`, `apps/local-server`, `apps/parent-relay` app skeletons with `package.json` and empty `src/index.ts`.
- `scripts/` and `tests/` directories with `.gitkeep`.
- Vitest base configuration.

## Explicitly excluded work
- No application logic, no schema, no routes, no UI components.
- No dependencies beyond the toolchain (TypeScript, ESLint, Prettier, tsup, Vitest, Zod).
- No Tauri setup yet (deferred to M14).
- No SQLite dependency yet (deferred to M03).

## Expected files or directories
- `package.json` (root)
- `tsconfig.base.json`
- `.eslintrc.cjs` / `eslint.config.js`
- `.prettierrc`
- `.gitignore`
- `vitest.config.ts`
- `apps/*/package.json`, `apps/*/src/index.ts`
- `packages/*/package.json`, `packages/*/src/index.ts`
- `scripts/.gitkeep`, `tests/.gitkeep`

## Acceptance criteria
- `npm install` completes without errors.
- `npm run build` builds all workspaces without errors.
- `npm run typecheck` passes with strict mode.
- `npm run lint` passes.
- `npm run test` runs Vitest and passes (zero tests is acceptable).
- Every workspace is resolvable by npm workspaces.

## Required automated tests
- A smoke test asserting the root build script exits 0.
- A smoke test asserting `packages/shared` exports a non-empty module.

## Manual verification steps
1. Run `npm install`.
2. Run `npm run build`.
3. Run `npm run typecheck`.
4. Run `npm run lint`.
5. Confirm no errors in any of the above.

## Completion checklist
- [ ] Root `package.json` with workspaces configured
- [ ] Strict `tsconfig.base.json`
- [ ] ESLint and Prettier configured
- [ ] tsup build configured for packages
- [ ] Vitest configured
- [ ] All workspace skeletons created
- [ ] `npm install`, `build`, `typecheck`, `lint`, `test` all pass