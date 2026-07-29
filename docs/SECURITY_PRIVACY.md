# Kumon SISO - Security & Child Data Privacy Specification

Kumon SISO is designed with strict data minimization principles:

---

## 1. Minimal Student Data Collection
- Only Student ID, Student Name, Parent 1 Phone, and optional Parent 2 Phone are stored.
- No emails, no physical home addresses, no birth dates, no parent names, no parent passwords or user accounts.

## 2. Opaque QR Tokens & Cryptographic Hash Protection
- QR codes encode purely cryptographically random identifiers. No student personal information or IDs are embedded inside QR codes.
- Parent session tokens are stored as SHA-256 hashes (`token_hash`). Raw tokens never appear in database logs.

## 3. Phone Number Masking
- All UI screens, reports, diagnostics, and exported logs mask phone numbers (`••• ••• 4567`).

## 4. Local-First & Zero Telemetry
- All database records remain on the center's local computer. No center data, tracking, or telemetry is transmitted to the distributor or third parties.
