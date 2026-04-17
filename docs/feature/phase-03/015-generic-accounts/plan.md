---
status: pending
---

# 015 — Generic IMAP/SMTP Accounts

## Phase
3 — Generic Accounts

## Goal
Support password/app-password-based accounts for any standards-compliant IMAP/SMTP provider (iCloud, Zoho, Fastmail, custom domains).

## Prerequisites
- 005-imap-sync-engine (sync works for OAuth accounts)
- 011-message-actions (write operations work)

## References
- `TECH_SPEC.md` §1.2 — generic account type
- `TECH_SPEC.md` §6.2 — password flow
- `TECH_SPEC.md` §5.2 — generic provider adapter

## Scope

### 1. Create the generic provider adapter
- Location: `src/server/providers/generic.ts`
- Standard folder role mapping using IMAP `\Special-Use` attributes
- Fallback heuristics: match common folder names (Sent, Drafts, Trash, Spam, Junk, Archive)
- Password-based auth for IMAP and SMTP

### 2. Add password account creation endpoint
- `POST /accounts` with `auth_type: "password"`
- Accept: email, username, password, IMAP/SMTP host/port/security settings
- Encrypt password with EncryptionService
- Test IMAP + SMTP before saving (concurrent via `Effect.all`)

### 3. Build the account setup UI
- Location: `src/client/components/AccountSetup/`
- Flow per TECH_SPEC §8.4:
  1. User enters email
  2. Run autodiscovery (016)
  3. Show discovered settings + password field
  4. Test connection
  5. Save account
- Loading states: "Looking up your mail settings...", "Testing incoming mail...", etc.

### 4. Manual fallback form
- If autodiscovery fails, expand full manual form:
  - IMAP host, port, security (SSL/TLS, STARTTLS, None)
  - SMTP host, port, security
  - Username (defaults to email)
  - Password / app password

## Verification
- Add an iCloud account with app-specific password
- Add a Fastmail account
- Add a custom-domain account with manual settings
- Folder sync, message sync, send all work

## Output
- `src/server/providers/generic.ts`
- Updated `src/server/api/accounts.ts`
- `src/client/components/AccountSetup/` components
