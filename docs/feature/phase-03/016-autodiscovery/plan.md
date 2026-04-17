---
status: pending
---

# 016 — Autodiscovery Pipeline

## Phase
3 — Generic Accounts

## Goal
Implement the layered autodiscovery pipeline: presets, autoconfig, MX lookup, and hostname heuristics. Given an email address, determine the likely IMAP/SMTP settings without user intervention.

## Prerequisites
- 015-generic-accounts (account creation flow that consumes discovery results)

## References
- `TECH_SPEC.md` §4.2 — autodiscovery pipeline (5 layers)
- `TECH_SPEC.md` §4.3 — discovery examples

## Scope

### 1. Create the provider registry (presets)
- Location: `src/server/setup/registry.ts`
- Hardcoded presets for known providers:
  - Gmail, Outlook (OAuth — redirect to OAuth flow)
  - iCloud: `imap.mail.me.com:993`, `smtp.mail.me.com:587` (STARTTLS)
  - Fastmail: `imap.fastmail.com:993`, `smtp.fastmail.com:465`
  - Zoho: `imap.zoho.com:993`, `smtp.zoho.com:465`
  - ProtonMail Bridge: `127.0.0.1:1143`, `127.0.0.1:1025`
- Match by exact domain first, then by MX pattern

### 2. Create the MX lookup module
- Location: `src/server/setup/mx.ts`
- Resolve MX records for the email domain using `dns.resolveMx`
- Map MX exchange hosts to known providers:
  - `*.google.com` / `*.googlemail.com` → Gmail
  - `*.protection.outlook.com` / `*.outlook.com` → Outlook
  - `*.mail.icloud.com` → iCloud
  - `*.zoho.com` → Zoho
  - `*.messagingengine.com` → Fastmail

### 3. Create autoconfig support
- Location: `src/server/setup/autodiscovery.ts`
- Try `https://autoconfig.{domain}/mail/config-v1.1.xml`
- Try `https://{domain}/.well-known/autoconfig/mail/config-v1.1.xml`
- Parse the Mozilla autoconfig XML format
- Extract IMAP and SMTP settings
- Use `Effect.timeout("5 seconds")` to avoid stalling

### 4. Create hostname heuristics
- Location: `src/server/setup/heuristics.ts`
- Try common hostname patterns concurrently via `Effect.raceAll`:
  - `imap.{domain}:993`
  - `mail.{domain}:993`
  - `{domain}:993`
  - `smtp.{domain}:465`
  - `smtp.{domain}:587`
  - `mail.{domain}:587`
- For each candidate, attempt a TCP connection (not full IMAP) to check if port is open
- Return first successful combination

### 5. Compose the pipeline
- Location: `src/server/setup/autodiscovery.ts`
- Chain: presets → autoconfig → MX → heuristics → manual fallback
- Use `Effect.orElse` to fall through on failure
- Return `AutodiscoveryResult`:
  ```ts
  { provider?, imapHost, imapPort, imapSecurity, smtpHost, smtpPort, smtpSecurity, source, confidence }
  ```
- Add API endpoint: `GET /accounts/autodiscover?email=...`

### 6. Create connection test endpoint
- `POST /accounts/test-connection` — test IMAP and SMTP with provided settings + credentials
- Returns success/failure for each with error details

## Verification
- `user@gmail.com` → detects Gmail preset (confidence 1.0)
- `user@contoso.com` with Outlook MX → detects Microsoft 365
- `user@christse.dev` with iCloud MX → detects iCloud settings
- `user@chris-tse.com` with Zoho MX → detects Zoho settings
- Unknown domain with `imap.example.com` responding → heuristic detection works
- Pipeline falls through gracefully when early stages fail
- Connection test confirms settings work with real credentials

## Output
- `src/server/setup/registry.ts`
- `src/server/setup/mx.ts`
- `src/server/setup/autodiscovery.ts`
- `src/server/setup/heuristics.ts`
- `src/server/setup/verify.ts`
- Updated `src/server/api/accounts.ts`
