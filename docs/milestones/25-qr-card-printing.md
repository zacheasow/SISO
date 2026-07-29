# Milestone 25 — QR-Card Printing

- **Status:** Not started
- **Objective:** Generate printable PDF QR cards with bulk/individual printing, card/label sizes, center logo, and "print missing" support.
- **Dependencies:** 06 (QR-code generation), 14 (Desktop application shell)

## Included work
- PDF generation with `pdfkit`: individual and bulk QR-card sheets.
- Card/label size presets (common sizes).
- Center logo and student name on printed cards.
- Individual QR-image download and ZIP download.
- "Print missing QR codes" (students without a printed flag).
- Test scan before bulk printing (scan-back verification).
- Desktop admin QR print center screen.
- PIN protection for bulk operations.
- Unit tests for PDF generation.

## Explicitly excluded work
- No physical printer integration beyond standard browser print dialog.
- No remote printing.

## Expected files or directories
- `apps/local-server/src/print/qr-cards.ts`
- `apps/local-server/src/routes/print.ts`
- `apps/local-server/src/__tests__/qr-cards.test.ts`
- `apps/desktop-admin/src/screens/qr-print-center.ts`
- `apps/desktop-admin/src/__tests__/qr-print-center.test.ts`

## Acceptance criteria
- Individual and bulk PDF generation produces valid PDFs.
- Cards include QR image, student name, and center logo.
- Multiple card/label sizes are supported.
- ZIP download of QR images works.
- "Print missing" identifies students without printed cards.
- Test-scan-before-bulk verification works.
- `npm run typecheck` and `npm run test` pass.

## Required automated tests
- PDF generation produces valid PDF bytes.
- Bulk sheet layout correctness.
- "Print missing" identification.
- ZIP download contents.

## Manual verification steps
1. Open the QR print center in the desktop app.
2. Generate a bulk PDF for a class and open it.
3. Confirm cards show QR, name, and logo.
4. Use "print missing" and confirm only unprinted students appear.

## Completion checklist
- [ ] PDF generation (individual + bulk)
- [ ] Card/label size presets
- [ ] Center logo + student name
- [ ] ZIP download
- [ ] "Print missing" support
- [ ] Test-scan-before-bulk
- [ ] Desktop QR print center screen
- [ ] Tests pass