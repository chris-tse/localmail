# Localmail — Technical Specification

(Final product name TBD)

> A local-first, keyboard-driven email client with a polished web UI.
> Built on Bun + TypeScript. No external services required — just `bun install && bun start`.

---

## 1. Product Overview

### 1.1 Vision

A self-hosted email client that runs as a local Bun server, providing a web-based UI at `localhost:3000`. It connects to multiple email providers via IMAP/SMTP, syncs recent mail into a local SQLite database, and delivers a fast, keyboard-driven experience inspired by Apple Mail's structural clarity and Superhuman's visual polish.

### 1.2 Target Account Types

Localmail v1 supports a small number of setup paths while keeping the underlying mail transport model consistent.

| Account type            | Auth method                       | Incoming | Outgoing | Setup style                          | Notes                                                                              |
| ----------------------- | --------------------------------- | -------- | -------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| Gmail                   | OAuth2                            | IMAP     | SMTP     | Preset                               | Gmail labels behave like virtual folders; `\All Mail` is special                   |
| Outlook / Microsoft 365 | OAuth2                            | IMAP     | SMTP     | Preset                               | More aggressive rate limiting; tenant settings may disable IMAP/SMTP AUTH          |
| Generic IMAP/SMTP       | Password or app-specific password | IMAP     | SMTP     | Autodiscovery first, manual fallback | Covers iCloud, Zoho, Fastmail, custom domains, and other standards-based providers |

### 1.3 Core Principles

- **Zero external services** — no Redis, no Postgres, no Docker. The only thing a user installs is Bun itself; everything else is `bun install && bun start`. npm packages (ImapFlow, Effect, etc.) are fine — those ship with the project.
- **Local-first** — all data stays on disk. No cloud relay.
- **Keyboard-driven** — every action reachable without a mouse.
- **Provider-agnostic normalization** — unified data model across all providers.
- **Autoconfig by default** — users should not need to know IMAP/SMTP hostnames in common cases.
- **Manual fallback always available** — discovery should help, not trap.

---

## 2. Architecture

### 2.1 High-Level Diagram

```text
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Sidebar  │  │ Message List │  │ Message Viewer    │  │
│  │ accounts │  │ folder view  │  │ HTML sandbox      │  │
│  │ folders  │  │ search       │  │ compose/reply     │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────┬──────────────────┬─────────────────┘
                     │ HttpApi (HTTP)   │ WebSocket
┌────────────────────┴──────────────────┴─────────────────┐
│              Bun Server (Effect Platform)                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ HttpApi     │  │ WS Hub       │  │ Auth Manager   │  │
│  │ accounts    │  │ push events  │  │ OAuth2 flows   │  │
│  │ folders     │  │ sync status  │  │ token refresh  │  │
│  │ messages    │  │ new mail     │  │ password auth  │  │
│  │ compose     │  │              │  │                │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │          │
│  ┌──────┴────────────────┴───────────────────┴────────┐ │
│  │                   Setup Engine                     │ │
│  │  presets · MX lookup · autoconfig · heuristics    │ │
│  └────────────────────────┬───────────────────────────┘ │
│                           │                             │
│  ┌────────────────────────┴───────────────────────────┐ │
│  │                   Sync Engine                      │ │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────────┐ │ │
│  │  │ ImapFlow   │  │ Scheduler│  │ MIME Parser    │ │ │
│  │  │ per-account│  │ poll/IDLE│  │ (mailparser)   │ │ │
│  │  └────────────┘  └──────────┘  └────────────────┘ │ │
│  └────────────────────────┬───────────────────────────┘ │
│                           │                             │
│  ┌────────────────────────┴───────────────────────────┐ │
│  │              SQLite (bun:sqlite, WAL mode)         │ │
│  │  accounts · folders · messages · attachments       │ │
│  │  contacts · messages_fts · sync_state              │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Process Model

Single Bun process, multi-concern, orchestrated by the **Effect runtime**:

- **HTTP server** (`@effect/platform-bun` → `BunHttpServer`) — serves the React SPA via `HttpStaticServer` and API endpoints via `HttpApi`
- **WebSocket server** — pushes real-time events to the frontend
- **Sync workers** — one ImapFlow connection per account, managed by the sync engine
- **Scheduler** — manages poll intervals and IDLE reconnection
- **Setup engine** — handles account autodiscovery and connection testing

No child processes, no worker threads needed at v1. A single-user client doesn't need concurrency isolation.

The server-side runtime is built on **Effect-TS**. Effect provides structured concurrency (fibers), typed error channels, resource lifecycle management (Scope), and composable retry/scheduling — all of which are load-bearing for a long-lived IMAP client. The dependency graph (DB → SyncEngine → AccountManager → IMAP connections) is wired via `Layer`, and the main server entrypoint runs inside a `ManagedRuntime` that guarantees cleanup of all connections on shutdown.

---

## 3. Data Model

### 3.1 SQLite Schema

All timestamps are ISO 8601 strings. All IDs are ULIDs for sortability.

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- Accounts
-- ============================================================
CREATE TABLE accounts (
  id              TEXT PRIMARY KEY,              -- ULID
  name            TEXT NOT NULL,                 -- Display name ("Work Gmail")
  email           TEXT NOT NULL,                 -- user@example.com
  provider        TEXT NOT NULL,                 -- 'gmail' | 'outlook' | 'generic'

  -- Connection config
  username        TEXT,                          -- Often same as email
  imap_host       TEXT NOT NULL,
  imap_port       INTEGER NOT NULL DEFAULT 993,
  imap_secure     INTEGER NOT NULL DEFAULT 1,

  smtp_host       TEXT NOT NULL,
  smtp_port       INTEGER NOT NULL DEFAULT 465,
  smtp_secure     INTEGER NOT NULL DEFAULT 1,
  smtp_starttls   INTEGER NOT NULL DEFAULT 0,

  -- Auth
  auth_type       TEXT NOT NULL,                 -- 'oauth2' | 'password'
  access_token    TEXT,                          -- encrypted at rest
  refresh_token   TEXT,                          -- encrypted at rest
  token_expiry    TEXT,                          -- ISO 8601
  oauth_client_id TEXT,
  oauth_client_secret TEXT,                      -- encrypted at rest
  password_secret TEXT,                          -- encrypted at rest

  -- Discovery metadata
  discovery_source TEXT,                         -- 'preset' | 'mx' | 'autoconfig' | 'heuristic' | 'manual'
  discovery_confidence REAL,                     -- 0..1

  -- Account state
  color           TEXT,                          -- Hex color for sidebar indicator
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,

  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_provider ON accounts(provider);

-- ============================================================
-- Folders
-- ============================================================
CREATE TABLE folders (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  path            TEXT NOT NULL,                 -- Raw IMAP path
  name            TEXT NOT NULL,                 -- Display name
  delimiter       TEXT,                          -- Hierarchy delimiter ("/" or ".")

  role            TEXT,                          -- 'inbox' | 'sent' | 'drafts' | 'trash' |
                                                -- 'spam' | 'archive' | 'all' | null

  uid_validity    INTEGER,
  uid_next        INTEGER,
  highest_modseq  TEXT,                          -- Can exceed JS integer range

  total_messages   INTEGER DEFAULT 0,
  unread_messages  INTEGER DEFAULT 0,
  last_synced_at   TEXT,

  sort_order      INTEGER NOT NULL DEFAULT 0,

  UNIQUE(account_id, path)
);

CREATE INDEX idx_folders_account ON folders(account_id);
CREATE INDEX idx_folders_role ON folders(account_id, role);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  folder_id       TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  uid             INTEGER NOT NULL,              -- IMAP UID within folder
  internet_message_id TEXT,                      -- RFC 2822 Message-ID header

  -- Threading
  thread_id       TEXT,
  in_reply_to     TEXT,
  references_json TEXT,                          -- JSON array of message-ids

  -- Envelope
  subject         TEXT,
  from_address    TEXT NOT NULL,                 -- JSON: { name, address }
  to_addresses    TEXT,                          -- JSON array
  cc_addresses    TEXT,                          -- JSON array
  bcc_addresses   TEXT,                          -- JSON array
  reply_to        TEXT,                          -- JSON: { name, address }
  date            TEXT NOT NULL,                 -- Message date (ISO 8601)

  -- Content
  snippet         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  has_body        INTEGER NOT NULL DEFAULT 0,

  -- Flags
  is_read         INTEGER NOT NULL DEFAULT 0,
  is_starred      INTEGER NOT NULL DEFAULT 0,
  is_answered     INTEGER NOT NULL DEFAULT 0,
  is_draft        INTEGER NOT NULL DEFAULT 0,
  is_deleted      INTEGER NOT NULL DEFAULT 0,

  -- Provider-specific extras
  labels_json     TEXT,                          -- JSON array (used mainly by Gmail)

  size_bytes      INTEGER,

  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at       TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(folder_id, uid)
);

CREATE INDEX idx_messages_account ON messages(account_id);
CREATE INDEX idx_messages_folder_date ON messages(folder_id, date DESC);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_message_id ON messages(internet_message_id);
CREATE INDEX idx_messages_unread
  ON messages(folder_id, is_read)
  WHERE is_read = 0;

-- ============================================================
-- Attachments (metadata only — fetched on demand)
-- ============================================================
CREATE TABLE attachments (
  id              TEXT PRIMARY KEY,
  message_id      TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  filename        TEXT,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER,
  content_id      TEXT,                          -- For inline images (CID)
  part_id         TEXT NOT NULL,                 -- IMAP BODYSTRUCTURE part number
  is_inline       INTEGER NOT NULL DEFAULT 0,

  disposition     TEXT                           -- 'attachment' | 'inline'
);

CREATE INDEX idx_attachments_message ON attachments(message_id);

-- ============================================================
-- Contacts (auto-populated from sent/received)
-- ============================================================
CREATE TABLE contacts (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  frequency       INTEGER NOT NULL DEFAULT 1,
  last_seen_at    TEXT NOT NULL,

  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_frequency ON contacts(frequency DESC);

-- ============================================================
-- Full-Text Search (FTS5)
-- ============================================================
CREATE VIRTUAL TABLE messages_fts USING fts5(
  subject,
  from_address,
  to_addresses,
  body_text,
  content='messages',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, from_address, to_addresses, body_text)
  VALUES (new.rowid, new.subject, new.from_address, new.to_addresses, new.body_text);
END;

CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, from_address, to_addresses, body_text)
  VALUES ('delete', old.rowid, old.subject, old.from_address, old.to_addresses, old.body_text);
END;

CREATE TRIGGER messages_fts_update AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, from_address, to_addresses, body_text)
  VALUES ('delete', old.rowid, old.subject, old.from_address, old.to_addresses, old.body_text);
  INSERT INTO messages_fts(rowid, subject, from_address, to_addresses, body_text)
  VALUES (new.rowid, new.subject, new.from_address, new.to_addresses, new.body_text);
END;

-- ============================================================
-- Sync State
-- ============================================================
CREATE TABLE sync_state (
  folder_id       TEXT PRIMARY KEY REFERENCES folders(id) ON DELETE CASCADE,

  sync_from       TEXT,                          -- Oldest message date in local cache

  last_uid        INTEGER,
  last_modseq     TEXT,

  status          TEXT NOT NULL DEFAULT 'idle',  -- 'idle' | 'syncing' | 'error'
  error_message   TEXT,
  last_full_sync  TEXT,

  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 3.2 Threading Strategy

Gmail may provide native thread hints via IMAP extensions. For all accounts, Localmail should still maintain a provider-agnostic threading strategy:

1. Parse `In-Reply-To` and `References` headers from each message.
2. Build a union-find structure: messages sharing any `Message-ID` in their reference chain belong to the same thread.
3. Assign a deterministic `thread_id` (hash of the root `Message-ID`).
4. On new message arrival, check if its `In-Reply-To` or `References` match any existing `internet_message_id` — if so, join that thread.

This matches the behavior of Thunderbird and most desktop clients. Edge cases with mailing lists and forwarded messages are handled by preferring `References` over `In-Reply-To`.

---

## 4. Account Setup and Autodiscovery

### 4.1 Setup Strategy

Localmail should optimize for minimal user input.

**Preset accounts:**

- Gmail → OAuth2 flow with Google
- Outlook / Microsoft 365 → OAuth2 flow with Microsoft

**Generic accounts:**

1. User enters email address
2. Localmail attempts autodiscovery
3. If settings are found, user enters password or app-specific password
4. Localmail tests IMAP and SMTP
5. If successful, account is saved
6. If autodiscovery fails, user falls back to manual server entry

### 4.2 Autodiscovery Pipeline

Autodiscovery should be layered, in this order. Model the pipeline as a chain of `Effect` values that short-circuit on first success using `Effect.orElse` (or equivalent). Each step returns either discovered settings or falls through. Timeouts on network-dependent steps (autoconfig, MX, heuristics) use `Effect.timeout` to avoid stalling the UI.

1. **Known provider presets**
   - Exact domain matches for Gmail, Outlook, iCloud, Fastmail, etc.
2. **Domain-published autoconfig**
   - Known autoconfig/autodiscover endpoints when available
3. **DNS MX inference**
   - Resolve MX records and infer provider from exchange hosts
4. **Hostname heuristics**
   - Try common hostnames like `imap.domain`, `smtp.domain`, `mail.domain` — use `Effect.raceAll` to probe multiple candidate hosts concurrently and take the first successful connection
5. **Manual fallback**
   - User enters settings explicitly

### 4.3 Autodiscovery Examples

| Email domain         | Discovery signal                | Inferred provider | Result                                     |
| -------------------- | ------------------------------- | ----------------- | ------------------------------------------ |
| `user@gmail.com`     | Exact domain preset             | Gmail             | OAuth2 preset                              |
| `user@contoso.com`   | MX → `*.protection.outlook.com` | Microsoft 365     | Outlook preset                             |
| `user@christse.dev`  | MX → `mx01.mail.icloud.com`     | iCloud            | Generic password flow with iCloud settings |
| `user@chris-tse.com` | MX → `mx.zoho.com`              | Zoho              | Generic password flow with Zoho settings   |

### 4.4 Credential Verification

Discovery and authentication are separate steps.

- Discovery determines likely connection settings
- Verification tests those settings with the user’s credentials

For password-based accounts:

1. Test IMAP login
2. Test SMTP auth
3. Save only if both succeed

For OAuth2 accounts:

1. Complete provider OAuth flow
2. Exchange code for tokens
3. Test IMAP and SMTP with OAuth tokens
4. Save only if both succeed

Both verification paths use `Effect.all` to run IMAP and SMTP tests concurrently (they're independent) and collect typed errors. An `AuthenticationFailure` is surfaced differently in the UI than a `ConnectionTimeout` — Effect's typed error channel makes this distinction compile-time safe.

### 4.5 Manual Fallback

If autodiscovery fails or the detected settings are wrong, the user can enter:

- email
- display name
- username
- IMAP host
- IMAP port
- IMAP security
- SMTP host
- SMTP port
- SMTP security
- password / app password

Manual settings always override discovered settings.

---

## 5. Sync Engine

### 5.1 Sync Strategy

The sync engine manages one `ImapFlow` connection per active account.

**Connection lifecycle:** Each IMAP connection is modeled as an Effect `Scope`-managed resource. ImapFlow does **not** handle reconnects automatically — on disconnect (`close` event), the owning fiber tears down the scope and retries with `Effect.retry` + `Schedule.exponential("1 second")` capped at 30 seconds via `Schedule.union(Schedule.spaced("30 seconds"))`. Auth failures (`AuthenticationFailure`) are tagged as a distinct error type and **not** retried — they surface immediately to the UI as a re-auth prompt.

**Per-account concurrency:** Use `FiberMap<AccountId, void>` to manage one sync fiber per active account. Adding/removing accounts adds/removes fibers. The FiberMap is scoped to the server's lifetime — on shutdown, all sync fibers are interrupted and all IMAP connections are cleaned up automatically.

**Initial sync (account setup):**

1. Connect via IMAP, list all folders.
2. Map special-use folders using IMAP `\Special-Use` attributes or heuristics.
3. For each folder, sync the most recent N days of messages (default 30 days).
4. Fetch envelope + flags + BODYSTRUCTURE + `References`/`In-Reply-To` headers for each message. (Note: `References` is not in the IMAP envelope — fetch it via `{ headers: ['references'] }` alongside the envelope.)
5. For the active folder (INBOX), also fetch body content for the recent window.
6. Store everything in SQLite.

**Ongoing sync:**

- **IDLE** — maintain an IDLE connection on the currently-viewed folder when supported. The IDLE loop runs as its own fiber; interrupting it (via `Fiber.interrupt`) cleanly breaks the IDLE command so the connection can SELECT another folder.
- **Polling** — use `Effect.repeat(syncFolder, Schedule.spaced("5 minutes"))` for non-IDLE folders. CONDSTORE or UID-based delta detection per folder.
- **On-demand** — when the user scrolls past the cached window, fetch older messages from IMAP and cache them

**Delta sync flow (per folder):**

```text
1. SELECT folder
2. Compare stored uid_validity — if changed, full resync needed
3. If CONDSTORE supported:
     FETCH 1:* (FLAGS) (CHANGEDSINCE <last_modseq>)
     → update flags on changed messages
4. FETCH <last_uid+1>:* — get new messages
5. Update sync_state cursors
```

### 5.2 Provider Handling

Provider adapters are modeled as Effect `Layer`s, so the sync engine depends on a `ProviderAdapter` service without knowing which concrete provider is wired in. Each account type provides its own layer at account-creation time.

```ts
interface ProviderAdapter {
  mapFolderRole(path: string, attributes: string[]): FolderRole | null;
  normalizeMessage(raw: FetchMessageObject): NormalizedMessage;
  refreshAuth(account: Account): Promise<AuthCredentials>;
}
```

MVP adapters:

- **Gmail adapter**
  - OAuth2 flow
  - Gmail folder/label quirks
  - Gmail-specific IMAP extensions when available

- **Outlook adapter**
  - OAuth2 flow
  - Outlook folder naming/rate limit behavior
  - Microsoft-specific token refresh behavior

- **Generic adapter**
  - Password-based IMAP/SMTP auth
  - Standard folder mapping
  - Works for iCloud, Zoho, Fastmail, and custom hosts unless a later dedicated adapter is added

### 5.3 Provider-Specific Notes

**Gmail quirks:**

- `[Gmail]/All Mail` contains all messages; other folders may act like label views
- Deleting in a label-folder may remove the label rather than delete the underlying message
- Archive = remove `INBOX` label
- `X-GM-LABELS` may be available
- Gmail threading hints may be available but should not replace the normalized thread model

**Outlook quirks:**

- More aggressive rate limiting — use `Effect.retry` with `Schedule.exponential("2 seconds")` composed with `Schedule.jittered` to avoid thundering-herd patterns. Tag rate-limit errors as a distinct error type so the retry schedule can be longer than for transient network errors.
- OAuth2 token refresh uses Microsoft-specific endpoints
- Some tenants disable IMAP or SMTP AUTH
- `Junk Email` instead of `Spam`

**Generic account quirks:**

- Settings vary widely
- Some providers require app-specific passwords
- Some providers are slower or have weaker IMAP capabilities
- Discovery should infer provider-hosted domains where possible, but connection logic remains standard IMAP/SMTP

### 5.4 Body Caching Strategy

| Scenario                                    | Body cached?                                |
| ------------------------------------------- | ------------------------------------------- |
| Message within sync window (recent 30 days) | Yes — fetched during sync                   |
| Message viewed by user outside window       | Yes — fetched on demand, cached permanently |
| Message never viewed, outside window        | No — envelope/flags only                    |

When the user opens a message without a cached body:

1. Fetch `BODY[]` via IMAP (acquires mailbox lock — use `Effect.acquireRelease` to guarantee the lock is released even on interruption or parse failure)
2. Parse MIME with `mailparser`
3. Store `body_text` and `body_html`
4. Extract and store attachment metadata
5. Set `has_body = 1`

---

## 6. Auth Flows

### 6.1 OAuth2 Credentials Strategy

Localmail ships with **bundled OAuth credentials** for Gmail and Outlook. Users should never need to register their own cloud projects — "Add Gmail Account" should just work.

**What this requires:**

| Provider | Registration                      | Verification                                                           | Restricted scope hurdle                                                                                                                                                    |
| -------- | --------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gmail    | Google Cloud Console project      | Google OAuth verification review + **CASA Tier 2 security assessment** | `https://mail.google.com/` is a restricted scope — Google requires a third-party security audit before the app can be used by more than 100 users without a warning screen |
| Outlook  | Azure AD (Entra) app registration | Microsoft publisher verification                                       | IMAP/SMTP scopes are not restricted — verification is lighter than Google's                                                                                                |

**Pre-launch steps (before public release):**

1. Register a Google Cloud project under a Localmail-owned Google account
2. Configure OAuth consent screen with privacy policy + homepage URLs
3. Request verification for the `https://mail.google.com/` scope
4. Complete CASA Tier 2 security assessment (typically takes 2–4 weeks, has a cost)
5. Register an Azure AD app for Outlook OAuth
6. Complete Microsoft publisher verification

**During development:** Use the unverified Google project with test users (up to 100). The "This app isn't verified" warning screen is acceptable for dev/testing. Add your own Google account as a test user in the Cloud Console.

**Bundled credentials are stored in the repo** (or fetched at build time) and shipped with the app. The `client_secret` for a "Desktop app" OAuth client is not truly secret (Google documents this) — it's embedded in every desktop/CLI app that uses Google OAuth. The security model relies on the redirect URI being `localhost`, not on the secret being hidden.

### 6.2 OAuth2 Flow (Gmail, Outlook)

```text
User clicks "Add Account" → selects Gmail or Outlook
  → Server generates auth URL with PKCE challenge
    using bundled client_id / client_secret
  → Browser opens provider sign-in page in popup/tab
  → User grants permission
  → Provider redirects to localhost:3000/auth/callback?code=...
  → Server exchanges code for access_token + refresh_token
  → Tokens encrypted and stored in accounts table
  → IMAP connection established with OAuth2 auth
  → SMTP connection established with OAuth2 auth
```

**Token refresh** runs proactively: use `Effect.repeat(refreshCheck, Schedule.spaced("1 minute"))` to check token expiry and refresh tokens 5 minutes before they expire. Tokens are stored in a `SynchronizedRef<TokenState>` per account — this ensures that if the IMAP fiber and SMTP send both need a fresh token simultaneously, only one refresh runs and the other waits for the result. On refresh failure, the account enters an `error` state and the UI shows a re-auth prompt.

**OAuth2 scopes required:**

| Provider | Scope                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Gmail    | `https://mail.google.com/`                                                                                   |
| Outlook  | `https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access` |

### 6.3 Password / App-Specific Password Flow (Generic Accounts)

```text
User clicks "Add Account" → selects Other email
  → User enters email address
  → Server runs autodiscovery
  → UI shows discovered provider/settings if available
  → User enters password or app-specific password
  → Server tests IMAP and SMTP auth
  → Secret encrypted and stored in accounts table
  → Account is saved and initial sync begins
```

From Localmail’s perspective, normal passwords and app-specific passwords are handled the same way: they are user-provided shared secrets for IMAP/SMTP auth.

### 6.4 Encryption at Rest

All credentials and secrets are encrypted using AES-256-GCM before storage. This includes:

- access tokens
- refresh tokens
- OAuth client secrets
- password/app-password secrets

The encryption key is derived from a machine-specific seed (hostname + OS user) via PBKDF2. This isn't vault-grade security, but it prevents casual exposure if the SQLite file is copied.

A future enhancement could integrate with the OS keychain (macOS Keychain, Windows Credential Manager) for key storage.

---

## 7. API Surface

### 7.1 Effect HttpApi

The API is defined using Effect's `HttpApi` + `HttpApiGroup` + `HttpApiEndpoint` modules. Schemas are defined with `effect/Schema` (replacing Zod). Each group is implemented via `HttpApiBuilder.group()` and composed into a single `HttpApi` that is served by `BunHttpServer`. A type-safe client can be derived from the same API definition via `HttpApiClient`.

```ts
import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

// --- Schemas (effect/Schema replaces Zod) ---

const AccountId = Schema.String.pipe(Schema.brand("AccountId"));
const FolderId = Schema.String.pipe(Schema.brand("FolderId"));
const MessageId = Schema.String.pipe(Schema.brand("MessageId"));

const Cursor = Schema.Struct({
  date: Schema.String,
  id: Schema.String,
});

const MessageFlags = Schema.Struct({
  is_read: Schema.optional(Schema.Boolean),
  is_starred: Schema.optional(Schema.Boolean),
  is_deleted: Schema.optional(Schema.Boolean),
});

const AddressSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  address: Schema.String,
});

// --- API Definition ---

const AccountsGroup = HttpApiGroup.make("accounts")
  .add(HttpApiEndpoint.get("list", "/accounts", { success: Schema.Array(Account) }))
  .add(HttpApiEndpoint.get("get", "/accounts/:id", { success: Account }))
  .add(
    HttpApiEndpoint.post("create", "/accounts", { success: Account, payload: CreateAccountInput }),
  )
  .add(
    HttpApiEndpoint.put("update", "/accounts/:id", {
      success: Account,
      payload: UpdateAccountInput,
    }),
  )
  .add(HttpApiEndpoint.del("delete", "/accounts/:id", { success: Schema.Void }))
  .add(
    HttpApiEndpoint.post("reauth", "/accounts/:id/reauth", {
      success: Schema.Struct({ authUrl: Schema.String }),
    }),
  )
  .add(
    HttpApiEndpoint.get("autodiscover", "/accounts/autodiscover", { success: AutodiscoveryResult }),
  )
  .add(
    HttpApiEndpoint.post("testConnection", "/accounts/test-connection", {
      success: TestConnectionResult,
      payload: TestConnectionInput,
    }),
  );

const FoldersGroup = HttpApiGroup.make("folders")
  .add(
    HttpApiEndpoint.get("list", "/accounts/:accountId/folders", { success: Schema.Array(Folder) }),
  )
  .add(HttpApiEndpoint.post("sync", "/folders/:folderId/sync", { success: SyncResult }));

const MessagesGroup = HttpApiGroup.make("messages")
  .add(HttpApiEndpoint.get("list", "/folders/:folderId/messages", { success: PaginatedMessages }))
  .add(HttpApiEndpoint.get("get", "/messages/:id", { success: MessageDetail }))
  .add(
    HttpApiEndpoint.patch("updateFlags", "/messages/flags", {
      success: Schema.Void,
      payload: Schema.Struct({ ids: Schema.Array(MessageId), flags: MessageFlags }),
    }),
  )
  .add(
    HttpApiEndpoint.post("move", "/messages/move", {
      success: Schema.Void,
      payload: Schema.Struct({ ids: Schema.Array(MessageId), targetFolderId: FolderId }),
    }),
  )
  .add(HttpApiEndpoint.del("delete", "/messages", { success: Schema.Void }));

const ComposeGroup = HttpApiGroup.make("compose")
  .add(
    HttpApiEndpoint.post("send", "/compose/send", {
      success: Schema.Struct({ messageId: Schema.String }),
      payload: Schema.Struct({
        accountId: AccountId,
        to: Schema.Array(AddressSchema),
        cc: Schema.optional(Schema.Array(AddressSchema)),
        bcc: Schema.optional(Schema.Array(AddressSchema)),
        subject: Schema.String,
        bodyHtml: Schema.String,
        bodyText: Schema.String,
        inReplyTo: Schema.optional(Schema.String),
      }),
    }),
  )
  .add(
    HttpApiEndpoint.post("saveDraft", "/compose/draft", {
      success: Schema.Struct({ id: Schema.String }),
      payload: DraftInput,
    }),
  );

const SearchGroup = HttpApiGroup.make("search").add(
  HttpApiEndpoint.get("query", "/search", { success: Schema.Array(SearchResult) }),
);

const AttachmentsGroup = HttpApiGroup.make("attachments").add(
  HttpApiEndpoint.get("download", "/attachments/:id/download", { success: AttachmentDownload }),
);

const ContactsGroup = HttpApiGroup.make("contacts").add(
  HttpApiEndpoint.get("search", "/contacts/search", { success: Schema.Array(Contact) }),
);

const Api = HttpApi.make("Localmail")
  .add(AccountsGroup)
  .add(FoldersGroup)
  .add(MessagesGroup)
  .add(ComposeGroup)
  .add(SearchGroup)
  .add(AttachmentsGroup)
  .add(ContactsGroup);
```

Each group is implemented separately via `HttpApiBuilder.group(Api, "accounts", (handlers) => ...)` and composed into layers. The server entrypoint wires all group layers together with `HttpApiBuilder.layer(Api)` and serves them via `BunHttpServer`.

On the frontend, the type-safe client is derived via `HttpApiClient.make(Api)` — this gives a typed object mirroring the API groups without needing a separate client library like `@trpc/client`.

### 7.2 WebSocket Events

The server pushes events to connected clients over a single WebSocket. Internally, events flow through an Effect `PubSub<WSEvent>` — sync fibers publish to it, and each WebSocket connection subscribes. PubSub handles backpressure (dropping oldest if a slow client falls behind) so a stalled WebSocket never blocks sync.

```ts
type WSEvent =
  | {
      type: "new_message";
      accountId: string;
      folderId: string;
      message: MessageSummary;
    }
  | {
      type: "flags_updated";
      messageIds: string[];
      flags: Partial<MessageFlags>;
    }
  | {
      type: "message_deleted";
      messageIds: string[];
    }
  | {
      type: "folder_counts";
      folderId: string;
      total: number;
      unread: number;
    }
  | {
      type: "sync_status";
      accountId: string;
      status: "syncing" | "idle" | "error";
      folder?: string;
    }
  | {
      type: "auth_error";
      accountId: string;
      message: string;
    };
```

---

## 8. Frontend

### 8.1 Stack

| Concern              | Choice                                | Rationale                                                                                   |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Framework            | React 19                              | Familiarity; focus energy on UX, not learning a new framework                               |
| Routing              | TanStack Router                       | Type-safe, file-based routes                                                                |
| State                | Zustand                               | Lightweight, no boilerplate                                                                 |
| Data fetching        | TanStack Query + Effect HttpApiClient | Cache invalidation, optimistic updates; type-safe client derived from server API definition |
| Styling              | Tailwind CSS                          | Rapid iteration on visual design                                                            |
| Keyboard shortcuts   | tinykeys                              | Small, composable hotkey library                                                            |
| HTML email rendering | iframe sandbox                        | Isolate untrusted email HTML                                                                |
| Rich text compose    | TipTap                                | Extensible, headless rich text editor                                                       |

### 8.2 Layout

Three-panel layout, resizable:

```text
┌──────────┬─────────────────┬──────────────────────────┐
│ Sidebar  │  Message List   │  Message Viewer          │
│          │                 │                          │
│ Accounts │  Sender         │  From: ...               │
│  ├ INBOX │  Subject snip.. │  To: ...                 │
│  ├ Sent  │  Date      ★    │  Date                    │
│  ├ Drafts│                 │                          │
│  └ ...   │  Sender         │  [rendered email body    │
│          │  Subject snip.. │   in sandboxed iframe]   │
│ Account2 │  Date           │                          │
│  ├ INBOX │                 │                          │
│  └ ...   │  ─────────────  │  [Reply] [Forward]       │
│          │  Load more...   │                          │
└──────────┴─────────────────┴──────────────────────────┘
```

### 8.3 Keyboard Shortcuts

| Key          | Action                         |
| ------------ | ------------------------------ |
| `j` / `k`    | Next / previous message        |
| `Enter`      | Open selected message          |
| `e`          | Archive                        |
| `#`          | Delete (move to trash)         |
| `r`          | Reply                          |
| `a`          | Reply all                      |
| `f`          | Forward                        |
| `c`          | Compose new                    |
| `s`          | Toggle star                    |
| `u`          | Toggle read/unread             |
| `/`          | Focus search                   |
| `Esc`        | Close compose / back to list   |
| `g` then `i` | Go to Inbox                    |
| `g` then `s` | Go to Sent                     |
| `g` then `d` | Go to Drafts                   |
| `1`–`9`      | Switch account (sidebar order) |
| `Cmd+Enter`  | Send message (in compose)      |
| `?`          | Show keyboard shortcut overlay |

### 8.4 Account Setup UX

Recommended add-account flows:

**Gmail**

- Button: `Continue with Google`

**Outlook**

- Button: `Continue with Microsoft`

**Other email**

1. User enters email address
2. Localmail attempts autodiscovery
3. If successful, show:
   - inferred provider if known
   - IMAP/SMTP settings
   - password/app-password field
4. If unsuccessful, expand manual settings form

Recommended loading states:

- `Looking up your mail settings...`
- `We found your provider`
- `Testing incoming mail...`
- `Testing outgoing mail...`
- `Syncing your inbox...`

### 8.5 HTML Email Rendering

Email HTML is untrusted and must be sandboxed:

1. Render in an `<iframe sandbox="allow-popups">`
2. Rewrite relative URLs to absolute
3. Proxy remote images through the local server to prevent tracking pixels
4. Inject a base stylesheet for consistent typography defaults
5. For plain-text emails, render with `white-space: pre-wrap` and auto-link URLs

---

## 9. Security Considerations

- **No remote access** — server binds to `127.0.0.1` only by default
- **Credential encryption** — all tokens and password secrets encrypted at rest
- **CSRF** — not a concern since no cookies are used
- **Email HTML** — sandboxed iframe with no script execution
- **Attachment handling** — served with `Content-Disposition: attachment` and strict `Content-Type`
- **OAuth2** — PKCE flow, tokens never exposed to the browser
- **Password handling** — secrets used only for IMAP/SMTP auth and never logged
- **Discovery safety** — autodiscovery should not blindly trust low-confidence guesses; users can inspect or override settings

---

## 10. Project Structure

```text
localmail/
├── package.json
├── bunfig.toml
├── tsconfig.json
├── drizzle.config.ts
│
├── src/
│   ├── server/
│   │   ├── index.ts                  # ManagedRuntime entrypoint, Layer composition
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle table definitions
│   │   │   ├── migrations/
│   │   │   └── client.ts             # Drizzle + bun:sqlite client
│   │   │
│   │   ├── api/
│   │   │   ├── definition.ts          # HttpApi + all HttpApiGroups (shared with client)
│   │   │   ├── accounts.ts            # HttpApiBuilder.group handlers
│   │   │   ├── folders.ts
│   │   │   ├── messages.ts
│   │   │   ├── compose.ts
│   │   │   ├── search.ts
│   │   │   └── attachments.ts
│   │   │
│   │   ├── setup/
│   │   │   ├── autodiscovery.ts
│   │   │   ├── mx.ts
│   │   │   ├── registry.ts
│   │   │   ├── heuristics.ts
│   │   │   └── verify.ts
│   │   │
│   │   ├── sync/
│   │   │   ├── engine.ts              # FiberMap per account, Scope per connection
│   │   │   ├── connection.ts          # ImapFlow wrapper with Effect retry/reconnect
│   │   │   ├── scheduler.ts           # Schedule-based poll loops
│   │   │   ├── threading.ts
│   │   │   └── mime.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── oauth2.ts              # SynchronizedRef for token state
│   │   │   ├── providers/
│   │   │   │   ├── gmail.ts
│   │   │   │   └── outlook.ts
│   │   │   └── crypto.ts
│   │   │
│   │   ├── ws/
│   │   │   └── hub.ts                 # PubSub<WSEvent> → WebSocket fan-out
│   │   │
│   │   └── providers/
│   │       ├── adapter.ts             # ProviderAdapter service (Layer-based)
│   │       ├── gmail.ts
│   │       ├── outlook.ts
│   │       └── generic.ts
│   │
│   ├── shared/
│   │   └── api.ts                     # Re-export of API definition for client import
│   │
│   └── client/
│       ├── index.html
│       ├── main.tsx
│       ├── api.ts                     # HttpApiClient.make(Api) — typed fetch client
│       ├── ws.ts
│       │
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── Sidebar/
│       │   ├── MessageList/
│       │   ├── MessageViewer/
│       │   ├── Compose/
│       │   ├── Search/
│       │   ├── AccountSetup/
│       │   └── shared/
│       │
│       ├── stores/
│       └── hooks/
│
├── data/
│   └── localmail.db
│
└── scripts/
    └── setup-oauth.ts
```

---

## 11. Dependencies

### Server

| Package                       | Purpose                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `effect`                      | Runtime, structured concurrency, typed errors, resource management, retry/scheduling, PubSub, `Schema` validation |
| `@effect/platform-bun`        | HTTP server (`BunHttpServer`), static file serving, WebSocket support, Bun runtime adapter                        |
| `imapflow`                    | IMAP client                                                                                                       |
| `nodemailer`                  | SMTP sending                                                                                                      |
| `mailparser`                  | MIME parsing                                                                                                      |
| `drizzle-orm` + `drizzle-kit` | SQLite ORM + migrations                                                                                           |
| `ulid`                        | Sortable unique IDs                                                                                               |

Note: `effect/Schema` replaces Zod for all validation. `effect/unstable/httpapi` (`HttpApi` + `HttpApiBuilder`) replaces both Hono and tRPC for the HTTP layer. No separate schema validation or HTTP framework packages needed.

### Client

| Package                  | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `react` + `react-dom`    | UI framework                             |
| `@tanstack/react-query`  | Cache + async state + optimistic updates |
| `@tanstack/react-router` | File-based routing                       |
| `zustand`                | Global state                             |
| `tailwindcss`            | Styling                                  |
| `tinykeys`               | Keyboard shortcuts                       |
| `@tiptap/react`          | Rich text editor                         |

---

## 12. Implementation Phases

### Phase 0 — OAuth Verification (long lead time, start immediately)

**Goal:** Unblock public release by completing provider verification in parallel with development.

- [ ] Register Google Cloud project, configure OAuth consent screen
- [ ] Submit for Google OAuth verification review
- [ ] Begin CASA Tier 2 security assessment for `https://mail.google.com/` restricted scope
- [ ] Register Azure AD (Entra) app for Outlook OAuth
- [ ] Complete Microsoft publisher verification
- [ ] Set up privacy policy + homepage URLs (can be minimal placeholder initially)

Note: During development, use the unverified Google app with manually-added test users. The verification/audit process runs in parallel and does not block any coding work — but it takes weeks, so start early.

### Phase 1 — Foundation (MVP)

**Goal:** Browse one Gmail account's INBOX in a web UI.

- [ ] SQLite schema + Drizzle setup
- [ ] Effect Layer wiring: BunHttpServer + HttpApi + DB layers
- [ ] Gmail OAuth2 flow (using bundled credentials, unverified app + test users for dev)
- [ ] ImapFlow connection + INBOX sync (recent 30 days)
- [ ] HttpApi routes: accounts, folders, messages (list + get)
- [ ] React three-panel layout (static)
- [ ] HttpApiClient integration on frontend with TanStack Query
- [ ] Message list with basic rendering
- [ ] Email body viewer (iframe sandbox)

### Phase 2 — Interaction

**Goal:** Full read/write workflow for Gmail and Outlook.

- [ ] Outlook OAuth2 flow
- [ ] Mark read/unread, star, delete, archive
- [ ] Move between folders
- [ ] Compose, reply, reply-all, forward (TipTap editor)
- [ ] SMTP sending via Nodemailer
- [ ] Draft save/restore
- [ ] Keyboard shortcuts (full set)

### Phase 3 — Generic Accounts

**Goal:** Support standards-based non-Google/non-Microsoft mail accounts.

- [ ] Generic IMAP/SMTP account type
- [ ] MX lookup + provider inference
- [ ] Domain autoconfig + hostname heuristics
- [ ] Manual server settings fallback
- [ ] Password/app-password setup flow
- [ ] Connection test UI
- [ ] iCloud / Zoho / Fastmail validation pass

### Phase 4 — Real-Time + Search

**Goal:** Live updates and fast search.

- [ ] IMAP IDLE for push notifications (fiber per account, `Fiber.interrupt` to break IDLE)
- [ ] WebSocket event hub (`PubSub<WSEvent>` → `BunHttpServer` WebSocket upgrade via `request.upgrade`)
- [ ] Polling scheduler for non-IDLE folders (`Effect.repeat` + `Schedule.spaced`)
- [ ] FTS5 search across all accounts
- [ ] Search UI with result highlighting

### Phase 5 — Polish

**Goal:** Superhuman-level feel.

- [ ] Unified inbox view
- [ ] Thread view with conversation grouping
- [ ] Contact autocomplete in compose
- [ ] Remote image proxy (tracking pixel protection)
- [ ] Keyboard shortcut overlay (`?`)
- [ ] Panel resize persistence
- [ ] Account color coding
- [ ] Loading states, error boundaries, empty states
- [ ] Credential encryption hardening / OS keychain integration

---

## 13. Open Questions & Decisions

Decisions are grouped by when they need to be made.

### 13.1 Decide Now (before Phase 1)

#### Q1. OAuth2 redirect strategy on localhost

**Options:**

- **(a)** Temporary local listener on a random port
- **(b)** Main server callback at `/auth/callback`
- **(c)** Manual code paste fallback

**Recommendation:** **(b)** — simpler UX, single code path.

#### Q2. Build tooling for the client bundle

**Options:**

- **(a)** Vite builds static assets into `dist/`, Effect `HttpStaticServer` serves them (SPA mode with index.html fallback)
- **(b)** Bun bundling only
- **(c)** Bun hot full-stack flow

**Recommendation:** **(a)** for stability. `HttpStaticServer.make({ root: "./dist", spa: true })` handles SPA routing and cache headers.

#### Q3. Drizzle + bun:sqlite stability

**Options:**

- **(a)** Use Drizzle + `bun:sqlite`
- **(b)** Fall back to `better-sqlite3`

**Recommendation:** Prototype `bun:sqlite` immediately; switch early if FTS5 or migrations are rough. Note: `@effect/sql-sqlite-bun` exists as a fallback for simple queries, but Drizzle's typed query builder is preferred for this schema's complexity (7 tables, FTS5, cursor pagination, joins).

#### Q4. OAuth2 credentials distribution

**Decision:** **(b)** Bundled shared credentials. Localmail ships with its own Google Cloud and Azure AD OAuth app credentials. Users never create their own cloud projects. See §6.1 for the verification requirements this entails. During development, use the unverified app with manually-added test users (Google allows up to 100).

#### Q5. Generic account setup model

**Options:**

- **(a)** Manual host entry only
- **(b)** Autodiscovery + manual fallback

**Recommendation:** **(b)**. Manual-only setup feels outdated and unnecessarily hostile.

### 13.2 Decide Soon (during Phase 1–2)

#### Q6. Message list pagination cursor

**Options:**

- **(a)** Date-based only
- **(b)** Composite `(date, ULID)`
- **(c)** Offset-based

**Recommendation:** **(b)**.

#### Q7. Thread view vs. flat list default

**Options:**

- **(a)** Flat list default, thread view toggle
- **(b)** Thread view default
- **(c)** Per-folder setting

**Recommendation:** **(a)**.

#### Q8. Optimistic updates for flag changes

**Options:**

- **(a)** Optimistic
- **(b)** Pessimistic

**Recommendation:** **(a)**.

#### Q9. How much autodiscovery to build in MVP

**Options:**

- **(a)** Presets + MX only
- **(b)** Presets + MX + autoconfig + heuristics
- **(c)** Full autodiscover ecosystem support

**Recommendation:** **(b)**. Good UX without falling into Exchange-style complexity.

### 13.3 Decide Later (Phase 3+)

#### Q10. Remote image loading default

**Options:**

- **(a)** Block by default
- **(b)** Load by default
- **(c)** Proxy by default

**Recommendation:** **(c)** eventually; start with **(a)** if needed earlier.

#### Q11. Gmail label management depth

**Options:**

- **(a)** Read-only
- **(b)** Add/remove labels
- **(c)** Full label CRUD

**Recommendation:** **(a)** first, then **(b)**.

#### Q12. Attachment upload flow for compose

**Options:**

- **(a)** Hold in browser memory
- **(b)** Upload to temp directory and reference by ID
- **(c)** Stream directly during send

**Recommendation:** **(b)** with a 25MB cap.

#### Q13. Unified inbox implementation

**Options:**

- **(a)** Virtual folder with `UNION ALL`
- **(b)** Dedicated cache table

**Recommendation:** **(a)**.

#### Q14. Cross-device story

**Options:**

- **(a)** Bind on LAN and run centrally
- **(b)** Tailscale / tunnel
- **(c)** Sync SQLite file

**Recommendation:** Not a v1 concern; if needed later, prefer **(a)** over syncing SQLite.

#### Q15. Backup and portability

**Options:**

- **(a)** Built-in export
- **(b)** Manual file copy docs
- **(c)** No official story

**Recommendation:** **(a)** eventually, but not urgent.

---

If you want, next I can do one of three useful follow-ups:

1. convert this into a tighter “RFC-style” engineering doc,
2. turn it into a concrete folder-by-folder implementation plan, or
3. produce the initial TypeScript types and Drizzle schema from this spec.
