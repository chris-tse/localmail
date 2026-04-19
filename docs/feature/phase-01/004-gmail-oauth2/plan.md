---
status: pending
---

# 004 — Gmail OAuth2 Flow

## Phase
1 — Foundation (MVP)

## Goal
Implement the Gmail OAuth2 authentication flow: generate auth URL with PKCE, handle the callback, exchange code for tokens, encrypt and store tokens, and verify IMAP/SMTP connectivity with the obtained credentials.

## Prerequisites
- 002-database-setup (accounts table for storing credentials)
- 003-effect-server (running HTTP server for callback route)

## References
- `TECH_SPEC.md` §6.1 — OAuth2 flow
- `TECH_SPEC.md` §6.3 — encryption at rest
- `docs/decisions.md` — OAuth callback runs on the main server; development server port is `4000`
- Google OAuth2 docs for Gmail IMAP scope

## Scope

### 1. Create the encryption module
- Location: `src/server/auth/crypto.ts`
- AES-256-GCM encryption/decryption functions
- Key derivation: PBKDF2 from machine-specific seed (hostname + OS user)
  - Allow override via `ENCRYPTION_KEY` env var
- Functions: `encrypt(plaintext: string): string`, `decrypt(ciphertext: string): string`
- Encrypted values stored as base64-encoded strings
- Expose as an Effect service (`EncryptionService` Layer)

### 2. Create the Gmail OAuth2 provider
- Location: `src/server/auth/providers/gmail.ts`
- Constants:
  - Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token URL: `https://oauth2.googleapis.com/token`
  - Scope: `https://mail.google.com/`
  - Redirect URI: `http://localhost:4000/auth/callback`
- Functions:
  - `generateAuthUrl(state, codeVerifier)` — returns auth URL with PKCE challenge
  - `exchangeCode(code, codeVerifier)` — exchanges code for access_token + refresh_token
  - `refreshToken(refreshToken)` — refreshes an expired access token

### 3. Create the OAuth2 orchestrator
- Location: `src/server/auth/oauth2.ts`
- Manages the flow state (PKCE verifier, state parameter) — store in-memory Map keyed by state
- Coordinates: generate URL → handle callback → exchange code → encrypt → store
- Token state per account: `SynchronizedRef<TokenState>` to prevent concurrent refresh races
- Expose as an Effect service (`OAuthService` Layer)

### 4. Add OAuth API endpoints
- Add to `src/server/api/definition.ts`:
  - `POST /accounts/oauth/start` — returns `{ authUrl: string }` for Gmail
  - `GET /auth/callback` — handles the OAuth redirect, exchanges code, creates account
- Add handler: `src/server/api/accounts.ts`

### 5. Create the account creation flow
- On successful OAuth callback:
  1. Exchange code for tokens
  2. Encrypt access_token, refresh_token
  3. Test IMAP connection with OAuth2 credentials (use ImapFlow)
  4. Test SMTP connection with OAuth2 credentials (use Nodemailer)
  5. If both succeed, create account row in DB with Gmail preset settings:
     - `imap_host: "imap.gmail.com"`, `imap_port: 993`
     - `smtp_host: "smtp.gmail.com"`, `smtp_port: 465`
     - `provider: "gmail"`, `auth_type: "oauth2"`
     - `discovery_source: "preset"`, `discovery_confidence: 1.0`
  6. Redirect browser to `/?account_created=<id>` (or similar success signal)
- IMAP and SMTP tests run concurrently via `Effect.all`

### 6. Create setup-oauth helper script
- Location: `scripts/setup-oauth.ts`
- Development-only helper for local credentials override; the product direction is bundled OAuth credentials per `TECH_SPEC.md` §6.1
- Interactive helper that guides maintainers/developers through:
  1. Creating a Google Cloud project
  2. Enabling the Gmail API
  3. Creating OAuth2 credentials
  4. Copying client ID and secret into `.env`

## Key Decisions to Research
- PKCE implementation: Bun's `crypto` for code_verifier and code_challenge (S256)
- How ImapFlow handles OAuth2 auth (`auth: { user, accessToken }`)
- How Nodemailer handles OAuth2 auth for SMTP
- Whether to open the auth URL in the user's browser automatically (`open` package or `Bun.spawn`)

## Verification
- OAuth flow completes end-to-end with a real Gmail account
- Tokens are encrypted in the database (not plaintext)
- IMAP connection succeeds with OAuth2 credentials
- SMTP connection succeeds with OAuth2 credentials
- Account row created in DB with correct fields
- OAuth redirect URI uses `http://localhost:4000/auth/callback`
- `bunx tsc --noEmit` passes
- `bun test` passes (unit tests for crypto, token exchange mocking)

## Output
- `src/server/auth/crypto.ts`
- `src/server/auth/oauth2.ts`
- `src/server/auth/providers/gmail.ts`
- `src/server/api/accounts.ts`
- Updated `src/server/api/definition.ts`
- `scripts/setup-oauth.ts`
