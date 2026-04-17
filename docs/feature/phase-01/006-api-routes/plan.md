---
status: pending
---

# 006 — API Routes (Read-Only)

## Phase
1 — Foundation (MVP)

## Goal
Implement the read-only API routes for accounts, folders, and messages. These endpoints power the frontend's initial data display — no write operations yet.

## Prerequisites
- 003-effect-server (HttpApi infrastructure)
- 005-imap-sync-engine (data in the database to query)

## References
- `TECH_SPEC.md` §7.1 — full HttpApi definition
- `TECH_SPEC.md` §13.2 Q6 — composite cursor pagination

## Scope

### 1. Define Schema types
- Location: `src/server/api/definition.ts`
- Add branded types: `AccountId`, `FolderId`, `MessageId`
- Add response schemas: `Account`, `Folder`, `Message`, `MessageDetail`, `PaginatedMessages`
- Add cursor schema: `{ date: string, id: string }`

### 2. Add AccountsGroup endpoints
- `GET /accounts` → list all accounts
- `GET /accounts/:id` → get single account (strip sensitive fields: tokens, passwords)
- Handler: `src/server/api/accounts.ts`
- Query accounts table via Drizzle

### 3. Add FoldersGroup endpoints
- `GET /accounts/:accountId/folders` → list folders for an account
  - Sort by: role-based ordering (inbox first, then sent, drafts, trash, spam, then alphabetical)
  - Include unread counts
- Handler: `src/server/api/folders.ts`

### 4. Add MessagesGroup endpoints
- `GET /folders/:folderId/messages` → paginated message list
  - Cursor-based pagination using composite `(date, id)`:
    ```sql
    WHERE (date < :cursor_date OR (date = :cursor_date AND id < :cursor_id))
    ORDER BY date DESC, id DESC
    LIMIT :limit
    ```
  - Default limit: 50
  - Return `{ messages, nextCursor }`
- `GET /messages/:id` → full message detail
  - Include body_text, body_html
  - If `has_body = 0`, trigger on-demand fetch via sync engine, then return
  - Include attachment metadata
- Handler: `src/server/api/messages.ts`

### 5. Add on-demand body fetch
- When `GET /messages/:id` is called for a message with `has_body = 0`:
  1. Call sync engine's `fetchBody(messageId)`
  2. Wait for fetch to complete
  3. Return the now-populated message
- Use `Effect.timeout("10 seconds")` for the IMAP fetch

### 6. Wire all groups into the API
- Update `src/server/api/definition.ts` with all groups
- Update `src/server/index.ts` layer composition to include all handler layers

## Verification
- `curl /accounts` returns account list
- `curl /accounts/:accountId/folders` returns folders with correct roles and counts
- `curl /folders/:folderId/messages` returns paginated messages
- Cursor pagination works correctly (no duplicates, no gaps)
- `curl /messages/:id` returns full message with body
- On-demand body fetch works for messages without cached body
- `bunx tsc --noEmit` passes
- `bun test` passes (unit tests for pagination logic, folder sorting)

## Output
- `src/server/api/definition.ts` (updated with all schemas + groups)
- `src/server/api/accounts.ts`
- `src/server/api/folders.ts`
- `src/server/api/messages.ts`
