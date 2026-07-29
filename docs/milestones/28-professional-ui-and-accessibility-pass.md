# Milestone 28 — Professional UI and Accessibility Pass

- **Status:** Not started
- **Objective:** Apply the design system, accessibility, and low-powered-device polish across the check-in PWA and desktop admin so the UI is professional and usable.
- **Dependencies:** 09 (Basic check-in interface), 14 (Desktop application shell)

## Included work
- Define the design system: color palette, typography scale, spacing scale, border-radius rules, shadow rules, buttons, forms, tables, status indicators, dialogs, loading/empty/error/success/offline states, responsive breakpoints.
- Apply consistent spacing, alignment, and visual hierarchy.
- Restrained professional colors; no excessive gradients, glassmorphism, or glowing effects.
- System or locally bundled fonts; no cloud fonts.
- Keyboard accessibility and visible focus states.
- WCAG 2.1 AA contrast where practical.
- Large touch targets; portrait and landscape layouts.
- Clear override and destructive action styling.
- Plain language; no technical database terminology for ordinary users.
- Minimal purposeful animation.
- Shared CSS tokens between PWA and admin.
- Unit tests for component rendering and a11y smoke checks.

## Explicitly excluded work
- No new features; this is a polish pass over existing screens.
- No E2E tests (deferred to M34).

## Expected files or directories
- `packages/shared/src/design-tokens.ts` (or `apps/*/src/styles/tokens.css`)
- `apps/check-in-pwa/src/styles/*`
- `apps/desktop-admin/src/styles/*`
- `apps/check-in-pwa/src/components/*` (refined)
- `apps/desktop-admin/src/components/*` (refined)
- `apps/check-in-pwa/src/__tests__/a11y.test.ts`
- `apps/desktop-admin/src/__tests__/a11y.test.ts`

## Acceptance criteria
- All screens use the design system tokens.
- Color contrast meets WCAG 2.1 AA where practical.
- Keyboard navigation works on all screens.
- Focus states are visible.
- Touch targets are large.
- No cloud fonts are loaded.
- Animations are minimal and purposeful.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- Design token usage consistency.
- A11y smoke checks (focusable elements, contrast where measurable).
- No cloud font requests.

## Manual verification steps
1. Open the PWA and desktop admin on different screen sizes.
2. Navigate by keyboard and confirm visible focus.
3. Confirm professional, restrained appearance with no gradients/glassmorphism.

## Completion checklist
- [ ] Design system defined (tokens, components, states)
- [ ] Applied to PWA and desktop admin
- [ ] Accessibility (keyboard, focus, contrast, touch targets)
- [ ] No cloud fonts
- [ ] Minimal animation
- [ ] Tests pass