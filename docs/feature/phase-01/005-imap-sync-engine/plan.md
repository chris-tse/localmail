---
status: pending
---

# 005 — IMAP Sync Engine

## Phase

1 — Foundation (MVP)

## Goal

Build the core sync engine: connect to Gmail via IMAP, list folders, map special-use roles, and sync the most recent 30 days of messages from INBOX into SQLite. This is the data pipeline that populates the message list.

## Prerequisites

- 002-database-setup (all tables: folders, messages, attachments, sync_state)
- 004-gmail-oauth2 (stored OAuth2 credentials for IMAP auth)

## References

- `TECH_SPEC.md` §5.1 — sync strategy (initial + delta)
- `TECH_SPEC.md` §5.2 — provider adapter interface
- `TECH_SPEC.md` §5.3 — Gmail quirks
- `TECH_SPEC.md` §5.4 — body caching strategy
- `TECH_SPEC.md` §3.2 — threading strategy

## Scope

### 1. Create the IMAP connection wrapper

- Location: `src/server/sync/connection.ts`
- Wrap ImapFlow in an Effect `Scope`-managed resource:
  - On acquire: create ImapFlow client, connect, authenticate
  - On release: logout and close connection
- Reconnection: on disconnect (`close` event), tear down scope, retry with `Effect.retry` + `Schedule.exponential("1 second")` capped at 30s
- Auth failures (`AuthenticationFailure`) are a distinct error type — NOT retried, surface to UI immediately
- Gmail OAuth2 auth config: `{ user: email, accessToken }`

### 2. Create the provider adapter interface

- Location: `src/server/providers/adapter.ts`
- Define the `ProviderAdapter` service interface:
  ```ts
  interface ProviderAdapter {
    mapFolderRole(path: string, attributes: string[]): FolderRole | null;
    normalizeMessage(raw: FetchMessageObject): NormalizedMessage;
    refreshAuth(account: Account): Effect<AuthCredentials, AuthError>;
  }
  ```
- Expose as an Effect `Context.Tag`

### 3. Create the Gmail adapter

- Location: `src/server/providers/gmail.ts`
- `mapFolderRole`:
  - `INBOX` → `inbox`
  - `[Gmail]/Sent Mail` → `sent`
  - `[Gmail]/Drafts` → `drafts`
  - `[Gmail]/Trash` → `trash`
  - `[Gmail]/Spam` → `spam`
  - `[Gmail]/All Mail` → `all`
  - `[Gmail]/Starred` → use `\Flagged` attribute
  - Use IMAP `\Special-Use` attributes as primary signal, path as fallback
- `normalizeMessage`: extract envelope, flags, parse References/In-Reply-To headers
- `refreshAuth`: delegate to OAuthService

### 4. Create the folder sync logic

- Location: `src/server/sync/engine.ts`
- `syncFolders(accountId)`:
  1. `LIST "" "*"` — get all folders
  2. Map each folder to its role using the provider adapter
  3. Upsert folders into the `folders` table
  4. Store uid_validity, uid_next from SELECT response

### 5. Create the message sync logic

- In `src/server/sync/engine.ts`:
- `syncMessages(folderId, options)`:
  1. SELECT the folder
  2. Compare stored `uid_validity` — if changed, full resync
  3. Fetch messages from the last 30 days:
     - `FETCH 1:* (ENVELOPE FLAGS BODYSTRUCTURE)` with `SINCE <30 days ago>`
     - Also fetch `BODY.PEEK[HEADER.FIELDS (REFERENCES IN-REPLY-TO)]`
  4. For each message, normalize via provider adapter
  5. Generate `thread_id` using the threading strategy (§3.2):
     - Parse In-Reply-To and References headers
     - Look up existing messages by internet_message_id
     - Assign thread_id (hash of root Message-ID)
  6. Upsert into `messages` table
  7. Extract attachment metadata from BODYSTRUCTURE → `attachments` table
  8. Update `sync_state` cursors (last_uid, last_modseq)

### 6. Create the body fetch logic

- `fetchBody(messageId)`:
  1. Fetch `BODY[]` for the message via IMAP
  2. Parse MIME with `mailparser`
  3. Store `body_text`, `body_html` in messages table
  4. Set `has_body = 1`
  5. Extract snippet (first ~200 chars of body_text)
- For INBOX initial sync: also fetch bodies for recent messages

### 7. Create the threading module

- Location: `src/server/sync/threading.ts`
- `assignThreadId(message, existingMessages)`:
  - Parse References header into array of Message-IDs
  - Check In-Reply-To header
  - Find existing messages with matching internet_message_id
  - Union-find: messages sharing any Message-ID in reference chain → same thread
  - Return deterministic thread_id (hash of root Message-ID)

### 8. Wire up the sync engine as an Effect Layer

- `SyncEngineLayer` depends on: `SqliteLive`/`SqlClient`, `OAuthService`, `ProviderAdapter`
- `startSync(accountId)`:
  1. Connect to IMAP
  2. Sync folders
  3. Sync INBOX messages (last 30 days, with bodies)
  4. Sync other folders (last 30 days, envelopes only)
- Use `FiberMap<AccountId, void>` to manage one sync fiber per account

### 9. Create the MIME parser wrapper

- Location: `src/server/sync/mime.ts`
- Wrap `mailparser`'s `simpleParser` for body parsing
- Extract: text body, HTML body, attachment metadata (filename, content-type, size, CID, part-id)

## Verification

- Connect to a real Gmail account via IMAP with OAuth2
- Folder list populated with correct roles
- INBOX messages from last 30 days synced to SQLite
- Message bodies fetched and stored for INBOX
- Threading assigns correct thread_ids to reply chains
- Attachment metadata extracted (no content downloaded)
- `sync_state` updated with correct cursors
- `bunx tsc --noEmit` passes
- `bun test` passes (unit tests for threading, MIME parsing, folder role mapping)

## Output

- `src/server/sync/connection.ts`
- `src/server/sync/engine.ts`
- `src/server/sync/threading.ts`
- `src/server/sync/mime.ts`
- `src/server/providers/adapter.ts`
- `src/server/providers/gmail.ts`
