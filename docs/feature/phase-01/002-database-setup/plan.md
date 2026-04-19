---
status: done
---

# 002 — Database Setup

## Phase

1 — Foundation (MVP)

## Goal

Establish the SQLite database layer using Effect SQL: `@effect/sql-sqlite-bun` over `bun:sqlite`, WAL mode, foreign keys, Effect-based migrations, typed database contracts, FTS5 search support, and a reusable DB client layer. Every subsequent feature depends on this.

During early solo development, local database data is disposable. Keep this feature on a single
canonical `0001_initial_schema.ts` migration and reset `data/localmail.db` when the schema changes.

## Prerequisites

- 001-project-scaffold (dependencies installed, directory structure)

## References

- `TECH_SPEC.md` §3.1 — full SQLite schema (7 tables + FTS5 + triggers)
- `TECH_SPEC.md` §3.2 — threading strategy
- `docs/decisions.md` — `@effect/sql-sqlite-bun over Drizzle ORM`

## Scope

### 1. Use Effect SQL instead of Drizzle

- Do **not** add `drizzle-orm`, `drizzle-kit`, `drizzle.config.ts`, `db:generate`, `db:push`, or `db:studio`
- Use `@effect/sql-sqlite-bun` and `effect/unstable/sql` APIs consistently
- Use Effect SQL tagged template queries for DB access
- Use `SqlSchema` where typed query/command helpers are useful for feature code
- Keep the architecture aligned with `docs/decisions.md`: the database is an Effect service, not a separate ORM layer

### 2. Define the database contract

- Location: `src/server/db/schema.ts`
- Export table name constants and TypeScript row/insert/update types for the application tables
- Types should match TECH_SPEC §3.1 exactly:

| Table         | Key columns                                                                                | Notes                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `accounts`    | id (ULID PK), email, provider, imap/smtp config, auth fields, discovery metadata           | Encrypted credential fields (access_token, refresh_token, password_secret, oauth_client_secret) |
| `folders`     | id (ULID PK), account_id (FK), path, name, role, uid_validity, uid_next, highest_modseq    | UNIQUE(account_id, path)                                                                        |
| `messages`    | id (ULID PK), account_id (FK), folder_id (FK), uid, envelope fields, content fields, flags | UNIQUE(folder_id, uid)                                                                          |
| `attachments` | id (ULID PK), message_id (FK), filename, content_type, part_id                             | Metadata only — content fetched on demand                                                       |
| `contacts`    | id (ULID PK), email (UNIQUE), name, frequency                                              | Auto-populated from sent/received                                                               |
| `sync_state`  | folder_id (PK, FK), last_uid, last_modseq, status                                          | One row per folder                                                                              |

- All timestamps as ISO 8601 strings
- All IDs as ULIDs (TEXT PRIMARY KEY)
- Boolean fields are stored as SQLite integers (`0`/`1`) and represented deliberately in TypeScript
- JSON columns remain `TEXT` at the storage layer; higher layers decode/encode typed structures
- Include helper unions for constrained values used by DB rows:
  - account provider: `gmail | outlook | generic`
  - auth type: `oauth2 | password`
  - folder role values from TECH_SPEC §3.1
  - sync status: `idle | syncing | error`

### 3. Create the Effect SQLite client layer

- Location: `src/server/db/client.ts`
- Create `data/` if it does not exist before opening the database
- Database file: `data/localmail.db`
- Export a reusable Effect layer, e.g. `DatabaseLayer` / `SqliteLive`
- Initialize each connection with:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  ```
- Provide small health/introspection helpers if needed by tests:
  - current `journal_mode`
  - current `foreign_keys`
  - migration table state

### 4. Create the initial Effect migration

- Location: `src/server/db/migrations/0001_initial_schema.ts`
- Use Effect migration files loaded by `Migrator.fromRecord()`
- Create all application tables from TECH_SPEC §3.1:
  - `accounts`
  - `folders`
  - `messages`
  - `attachments`
  - `contacts`
  - `sync_state`
- Define all indexes from TECH_SPEC §3.1
- Preserve foreign keys and `ON DELETE CASCADE` behavior
- Make migrations idempotent enough for local development (`IF NOT EXISTS` where appropriate)
- Keep raw SQL close to the TECH_SPEC schema so future diffs are easy to audit

### 5. Create FTS5 virtual table and triggers

- `messages_fts` using FTS5 with `porter unicode61` tokenizer
- Content table: `messages`
- Columns: subject, from_address, to_addresses, body_text
- Create the three triggers (insert, delete, update) that keep FTS in sync
- Verify FTS5 works through `bun:sqlite` and `@effect/sql-sqlite-bun`
- If trigger creation needs raw SQLite execution because of `BEGIN`/`END` blocks, document the workaround in code comments and/or `docs/decisions.md`

### 6. Wire migration scripts

- Location: `scripts/migrate.ts`
- Load migrations from `src/server/db/migrations/`
- Run through `@effect/sql-sqlite-bun` migrator
- Ensure `bun run scripts/migrate.ts` creates/updates `data/localmail.db`
- Ensure `bun run dev` runs migrations before seeding
- Add/keep package scripts:
  - `db:migrate` — runs `scripts/migrate.ts`
  - `db:seed` — runs `scripts/seed.ts`
- Do not keep Drizzle-specific scripts unless the decision is reversed

### 7. Research: bun:sqlite + Effect SQL + FTS5 compatibility

- Verify FTS5 is available in bun:sqlite
- Verify triggers work correctly
- Verify WAL mode works
- Verify `PRAGMA foreign_keys = ON` is enabled for application connections, not only migration connections
- Document any workarounds needed in `docs/decisions.md`

### 8. Write DB smoke tests

- Add a basic database test, colocated under `src/server/db/`
- Use a temporary SQLite file, not `data/localmail.db`
- Test:
  - foreign keys are enforced
  - cascade deletes remove dependent mailbox records
  - invalid foreign key insert fails
  - FTS returns inserted message content
  - FTS update/delete triggers update the search index
  - database-generated timestamps are parseable UTC strings

## Verification

- `bunx tsc --noEmit` passes
- `bun run scripts/migrate.ts` creates/updates `data/localmail.db`
- `bun run scripts/seed.ts` remains idempotent after migration changes
- `bun test` passes
- All application tables + FTS5 virtual table are created successfully:
  - `accounts`
  - `folders`
  - `messages`
  - `attachments`
  - `contacts`
  - `sync_state`
  - `messages_fts`
- FTS5 triggers fire correctly on insert/update/delete
- WAL mode and foreign keys are enabled
- Seeded mock data is queryable after migrations

## Output

- `src/server/db/schema.ts`
- `src/server/db/client.ts`
- `src/server/db/migrations/0001_initial_schema.ts`
- `scripts/migrate.ts`
- Basic DB smoke test
