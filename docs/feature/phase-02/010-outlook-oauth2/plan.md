---
status: pending
---

# 010 — Outlook OAuth2 Flow

## Phase

2 — Interaction

## Goal

Add Microsoft/Outlook OAuth2 support, including the Outlook provider adapter for folder mapping and rate-limit-aware retry logic.

## Prerequisites

- 004-gmail-oauth2 (OAuth2 infrastructure, crypto module)
- 005-imap-sync-engine (provider adapter interface)

## References

- `TECH_SPEC.md` §6.1 — OAuth2 flow (Outlook scopes)
- `TECH_SPEC.md` §5.2 — provider adapter
- `TECH_SPEC.md` §5.3 — Outlook quirks

## Scope

### 1. Create the Outlook OAuth2 provider

- Location: `src/server/auth/providers/outlook.ts`
- Microsoft identity platform endpoints:
  - Auth URL: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
  - Token URL: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
  - Scopes: `https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access`
- PKCE flow (same pattern as Gmail)
- Token refresh via Microsoft-specific endpoint

### 2. Create the Outlook provider adapter

- Location: `src/server/providers/outlook.ts`
- `mapFolderRole`:
  - `Inbox` → `inbox`
  - `Sent Items` → `sent`
  - `Drafts` → `drafts`
  - `Deleted Items` → `trash`
  - `Junk Email` → `spam`
  - `Archive` → `archive`
- Rate-limit handling: `Effect.retry` with `Schedule.exponential("2 seconds")` + `Schedule.jittered`
- Tag rate-limit errors as a distinct error type

### 3. Wire Outlook into account creation flow

- Update `POST /accounts/oauth/start` to accept `provider: "gmail" | "outlook"`
- Update callback handler to detect provider from OAuth state
- Outlook preset settings:
  - `imap_host: "outlook.office365.com"`, `imap_port: 993`
  - `smtp_host: "smtp.office365.com"`, `smtp_port: 587`
  - `smtp_starttls: 1` (Outlook uses STARTTLS, not implicit TLS for SMTP)

### 4. Add env vars for Microsoft OAuth

- Update `.env.example`:
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`
- Update `scripts/setup-oauth.ts` with Microsoft Azure AD app registration instructions

## Verification

- OAuth flow completes with a real Outlook/Microsoft 365 account
- Folder roles mapped correctly (especially `Junk Email` → `spam`)
- IMAP sync works with Outlook OAuth2 credentials
- SMTP auth works (STARTTLS on port 587)
- Rate-limit retry logic handles 429 responses gracefully

## Output

- `src/server/auth/providers/outlook.ts`
- `src/server/providers/outlook.ts`
- Updated `src/server/api/accounts.ts`
- Updated `.env.example`
