---
status: pending
---

# 002 — Database Setup

## Phase
1 — Foundation (MVP)

## Goal
Establish the SQLite database layer: Drizzle ORM schema, `bun:sqlite` connection in WAL mode, migrations, and a reusable DB client module. Every subsequent feature depends on this.

## Prerequisites
- 001-project-scaffold (dependencies installed, directory structure)

## References
- `TECH_SPEC.md` §3.1 — full SQLite schema (7 tables + FTS5 + triggers)
- `TECH_SPEC.md` §3.2 — threading strategy

## Scope

### 1. Create Drizzle schema
- Location: `src/server/db/schema.ts`
- Tables to define, matching TECH_SPEC §3.1 exactly:

| Table | Key columns | Notes |
|---|---|---|
| `accounts` | id (ULID PK), email, provider, imap/smtp config, auth fields, discovery metadata | Encrypted credential fields (access_token, refresh_token, password_secret, oauth_client_secret) |
| `folders` | id (ULID PK), account_id (FK), path, name, role, uid_validity, uid_next, highest_modseq | UNIQUE(account_id, path) |
| `messages` | id (ULID PK), account_id (FK), folder_id (FK), uid, envelope fields, content fields, flags | UNIQUE(folder_id, uid) |
| `attachments` | id (ULID PK), message_id (FK), filename, content_type, part_id | Metadata only — content fetched on demand |
| `contacts` | id (ULID PK), email (UNIQUE), name, frequency | Auto-populated from sent/received |
| `sync_state` | folder_id (PK, FK), last_uid, last_modseq, status | One row per folder |

- All timestamps as ISO 8601 strings
- All IDs as ULIDs (TEXT PRIMARY KEY)
- Define all indexes from TECH_SPEC §3.1
- Export inferred TypeScript types for each table

### 2. Create FTS5 virtual table
- `messages_fts` using FTS5 with `porter unicode61` tokenizer
- Content table: `messages`
- Columns: subject, from_address, to_addresses, body_text
- Research: Drizzle's FTS5 support with `bun:sqlite` — may need raw SQL for the virtual table creation and triggers
- Create the three triggers (insert, delete, update) that keep FTS in sync

### 3. Create DB client module
- Location: `src/server/db/client.ts`
- Initialize `bun:sqlite` with WAL mode and foreign keys enabled:
  ```
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  ```
- Wrap with Drizzle ORM
- Export as an Effect `Layer` (e.g., `DatabaseLayer`) so other services can depend on it
- Database file at `data/localmail.db`
- Create `data/` directory if it doesn't exist

### 4. Configure Drizzle Kit
- Create `drizzle.config.ts` at project root
- Point schema to `src/server/db/schema.ts`
- Configure migration output: `src/server/db/migrations/`
- Dialect: `sqlite`
- Driver: `bun:sqlite` (research Drizzle Kit's bun:sqlite support)

### 5. Generate initial migration
- Run `bunx drizzle-kit generate` to produce the initial SQL migration
- Verify the generated SQL matches TECH_SPEC §3.1
- If FTS5/triggers aren't handled by Drizzle, add a custom migration SQL file

### 6. Research: bun:sqlite + Drizzle + FTS5 compatibility
- Verify FTS5 is available in bun:sqlite
- Verify triggers work correctly
- Verify WAL mode works
- Document any workarounds needed in `docs/decisions.md`

## Verification
- `bunx tsc --noEmit` passes
- `bunx drizzle-kit generate` produces a valid migration
- `bun test` passes (write a basic test: open DB, create a row, query it)
- All 7 tables + FTS5 virtual table created successfully
- FTS5 triggers fire correctly on insert/update/delete
- WAL mode and foreign keys are enabled

## Output
- `src/server/db/schema.ts`
- `src/server/db/client.ts`
- `drizzle.config.ts`
- `src/server/db/migrations/` (initial migration)
- Basic DB smoke test
