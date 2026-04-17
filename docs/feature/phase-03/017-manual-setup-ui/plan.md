---
status: pending
---

# 017 — Manual Setup UI + Connection Test

## Phase
3 — Generic Accounts

## Goal
Build the manual server settings form and live connection test UI as the fallback when autodiscovery fails or returns incorrect settings.

## Prerequisites
- 015-generic-accounts (account setup component shell)
- 016-autodiscovery (autodiscovery results to pre-fill, test endpoint)

## References
- `TECH_SPEC.md` §4.5 — manual fallback fields
- `TECH_SPEC.md` §8.4 — setup UX

## Scope

### 1. Manual settings form
- Expand the AccountSetup component with editable fields:
  - IMAP: host, port, security (SSL/TLS, STARTTLS, None)
  - SMTP: host, port, security
  - Username (defaults to email)
  - Password / app password
- Pre-fill from autodiscovery results when available
- Allow user to override any field

### 2. Live connection test UI
- "Test Connection" button that hits `POST /accounts/test-connection`
- Show per-protocol status:
  - IMAP: testing... / connected / failed (with error message)
  - SMTP: testing... / connected / failed (with error message)
- Run tests concurrently, show results as they arrive
- "Save Account" button only enabled when both tests pass

### 3. Error messaging
- Translate common errors to user-friendly messages:
  - Auth failure → "Invalid username or password. If your provider requires an app password, use that instead."
  - Connection refused → "Could not connect to {host}:{port}. Check the hostname and port."
  - Timeout → "Connection timed out. The server may be unreachable."
  - Certificate error → "SSL certificate error. Try a different security setting."

## Verification
- Manual form is editable and overrides autodiscovery
- Connection test shows real-time status for IMAP and SMTP
- Error messages are user-friendly
- Account only saveable after successful test
- Works for iCloud, Zoho, Fastmail, and custom domains

## Output
- Updated `src/client/components/AccountSetup/` components
