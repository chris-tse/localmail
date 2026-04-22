---
status: pending
---

# 004 — Gmail OAuth2 Flow

## Phase

1 — Foundation (MVP)

## Goal

Implement the Gmail OAuth2 authentication flow for the packaged Localmail app: use the Localmail-owned Google OAuth desktop client, generate an auth URL with PKCE, handle the loopback callback, exchange the code for tokens without a shipped client secret, encrypt and store tokens locally, and verify IMAP/SMTP connectivity with the obtained credentials.

## Prerequisites

- 002-database-setup (accounts table for storing credentials)
- 003-effect-server (running HTTP server for callback route)

## References

- `TECH_SPEC.md` §6.1 — OAuth2 flow
- `TECH_SPEC.md` §6.3 — encryption at rest
- `docs/decisions.md` — OAuth callback runs on the main server; development server port is `4000`
- `TECH_SPEC.md` Q4 — OAuth2 credentials distribution
- `docs/decisions.md` — Google OAuth credentials distribution for desktop
- Google OAuth2 docs for Gmail IMAP scope
- Google OAuth2 docs for iOS & Desktop Apps / PKCE

## Scope

### 0. Add Google OAuth client dependency

- Add `google-auth-library`.
- Use `OAuth2Client` for:
  - generating PKCE verifier/challenge via `generateCodeVerifierAsync()`
  - building the Google consent URL
  - exchanging the callback code for tokens with `codeVerifier`
  - refreshing access tokens
- Do not hand-roll low-level OAuth parameter encoding unless the library cannot support a required detail.

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
- Use a Google OAuth **Desktop app** client owned by Localmail.
- Package/build with the public Google OAuth client ID.
- Do not package or require `GOOGLE_CLIENT_SECRET` for the desktop flow. Installed apps cannot keep a client secret confidential; PKCE is the proof mechanism.
- Constants:
  - Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token URL: `https://oauth2.googleapis.com/token`
  - Scope: `https://mail.google.com/`
  - Redirect URI: loopback callback on the local server, preferably `http://127.0.0.1:<port>/auth/callback`
    - Development currently uses the main Bun server port (`4000`)
    - Packaged desktop builds may choose a runtime port if needed
- Functions:
  - `generateAuthUrl(state)` — generates PKCE verifier/challenge, stores verifier by state, returns auth URL
  - `exchangeCode(code, codeVerifier)` — exchanges code + PKCE verifier for access_token + refresh_token
  - `refreshToken(refreshToken)` — refreshes an expired access token
- Auth URL parameters:
  - `client_id`
  - `redirect_uri`
  - `response_type=code`
  - `scope=https://mail.google.com/`
  - `state`
  - `code_challenge`
  - `code_challenge_method=S256`
  - `access_type=offline`
  - `prompt=consent` when needed to force refresh-token issuance during development/re-consent
- Open the URL in the user's system browser. Do not render Google OAuth inside an embedded Electron/Electrobun webview.

### 3. Create the OAuth2 orchestrator

- Location: `src/server/auth/oauth2.ts`
- Manages flow state (PKCE verifier, state parameter, provider, creation timestamp) in a short-lived in-memory Map keyed by `state`
- Expires stale pending OAuth attempts
- Coordinates: generate URL → handle callback → exchange code → encrypt → store
- Token state per account: `SynchronizedRef<TokenState>` to prevent concurrent refresh races
- Expose as an Effect service (`OAuthService` Layer)

### 4. Add OAuth API endpoints

- Add to `src/server/api/definition.ts`:
  - `POST /accounts/oauth/start` — returns `{ authUrl: string }` for Gmail
  - `GET /auth/callback` — handles the OAuth redirect, exchanges code, creates account
- Add handler: `src/server/api/accounts.ts`
- The start endpoint should not require any user-provided Google Cloud credentials.
- Missing Localmail OAuth client configuration should produce a clear maintainer/developer error, not a user setup flow.

### 5. Create the account creation flow

- On successful OAuth callback:
  1. Validate `state` and recover the matching PKCE verifier
  2. Exchange code + verifier for tokens
  3. Encrypt access_token, refresh_token
  4. Test IMAP connection with OAuth2 credentials (use ImapFlow)
  5. Test SMTP connection with OAuth2 credentials (use Nodemailer)
  6. If both succeed, create account row in DB with Gmail preset settings:
     - `imap_host: "imap.gmail.com"`, `imap_port: 993`
     - `smtp_host: "smtp.gmail.com"`, `smtp_port: 465`
     - `provider: "gmail"`, `auth_type: "oauth2"`
     - `discovery_source: "preset"`, `discovery_confidence: 1.0`
  7. Redirect browser to `/?account_created=<id>` (or similar success signal)
- IMAP and SMTP tests run concurrently via `Effect.all`

### 6. Create maintainer OAuth setup docs/helper

- Location: `scripts/setup-oauth-dev.ts` or docs under `docs/`
- Purpose: maintainer/contributor setup only, not end-user setup.
- Document:
  1. Localmail-owned Google Cloud project
  2. Gmail API enabled
  3. OAuth consent screen, privacy policy, homepage, and support email
  4. Desktop OAuth client for Localmail
  5. Development/test client IDs and test users
  6. Release build configuration for bundling the public client ID
- Do not instruct normal users to create a Google Cloud project or copy credentials into `.env`.

## Key Decisions to Research

- Exact redirect behavior for packaged desktop builds:
  - fixed main server port vs runtime-selected loopback port
  - `127.0.0.1` preferred over `localhost`
- `google-auth-library` behavior under Bun for PKCE auth URL generation, token exchange, and refresh
- How ImapFlow handles OAuth2 auth (`auth: { user, accessToken }`)
- How Nodemailer handles OAuth2 auth for SMTP
- Best way to open the system browser from Bun/Electrobun without embedding Google OAuth

## Verification

- OAuth flow completes end-to-end with a real Gmail account
- Flow uses the Localmail-owned OAuth client ID and does not require per-user Google Cloud setup
- Token exchange succeeds with PKCE and without a shipped client secret
- Tokens are encrypted in the database (not plaintext)
- IMAP connection succeeds with OAuth2 credentials
- SMTP connection succeeds with OAuth2 credentials
- Account row created in DB with correct fields
- OAuth opens in the system browser and returns through the local loopback callback
- `bunx tsc --noEmit` passes
- `bun test` passes (unit tests for crypto, token exchange mocking)

## Output

- Updated `package.json` / lockfile with `google-auth-library`
- `src/server/auth/crypto.ts`
- `src/server/auth/oauth2.ts`
- `src/server/auth/providers/gmail.ts`
- `src/server/api/accounts.ts`
- Updated `src/server/api/definition.ts`
- Maintainer/contributor OAuth setup notes or `scripts/setup-oauth-dev.ts`
