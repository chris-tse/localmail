# 002 Database Setup — Tasks

Each task below is independently executable. Tasks are ordered by dependency.
Status key: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` skipped/cancelled.

---

## Task 1: Align package scripts and dependency boundary

- [x] Confirm `@effect/sql-sqlite-bun` is installed and usable
- [x] Confirm no Drizzle dependencies or config files are introduced for this feature
- [x] Add or keep package scripts:
  - [x] `db:migrate` runs `bun run scripts/migrate.ts`
  - [x] `db:seed` runs `bun run scripts/seed.ts`
- [x] Remove any stale Drizzle-specific database scripts if present

**Files:** `package.json`, `bun.lock`
**Depends on:** None
**Verify:** `bun install --frozen-lockfile`, `bun run db:migrate`

---

## Task 2: Define typed database contracts

- [x] Update `src/server/db/schema.ts` with table name constants for all storage objects:
  - [x] `accounts`
  - [x] `folders`
  - [x] `messages`
  - [x] `attachments`
  - [x] `contacts`
  - [x] `sync_state`
  - [x] `messages_fts`
- [x] Export row types for each application table
- [x] Export insert/update types where feature code will write rows
- [x] Add constrained value unions:
  - [x] account provider: `gmail | outlook | generic`
  - [x] auth type: `oauth2 | password`
  - [x] folder role values from `TECH_SPEC.md` §3.1
  - [x] sync status: `idle | syncing | error`
- [x] Represent SQLite boolean fields deliberately as `0 | 1`
- [x] Keep JSON columns typed as storage strings at the DB layer

**File:** `src/server/db/schema.ts`
**Depends on:** Task 1
**Verify:** `bunx tsc --noEmit`

---

## Task 3: Implement the reusable SQLite client layer

- [x] Ensure `data/` is created before opening `data/localmail.db`
- [x] Export the shared Effect SQLite layer used by server code and scripts
- [x] Enable WAL mode for application connections
- [x] Enable foreign keys for application connections
- [x] Add small DB introspection helpers if useful for tests:
  - [x] read current `journal_mode`
  - [x] read current `foreign_keys`
  - [x] list migrated tables

**File:** `src/server/db/client.ts`
**Depends on:** Task 1
**Verify:** `bunx tsc --noEmit`

---

## Task 4: Complete the initial Effect migration

- [x] Update `src/server/db/migrations/0001_initial_schema.ts` to match `TECH_SPEC.md` §3.1
- [x] Create or preserve all application tables:
  - [x] `accounts`
  - [x] `folders`
  - [x] `messages`
  - [x] `attachments`
  - [x] `contacts`
  - [x] `sync_state`
- [x] Add missing `sync_state` table if not already present
- [x] Preserve all foreign keys and `ON DELETE CASCADE` behavior
- [x] Preserve all unique constraints from the tech spec
- [x] Create all indexes from the tech spec
- [x] Keep timestamp defaults and ISO 8601 string storage
- [x] Keep migration SQL close to the tech spec for easy audit

**File:** `src/server/db/migrations/0001_initial_schema.ts`
**Depends on:** Task 2, Task 3
**Verify:** `bun run db:migrate`

---

## Task 5: Verify FTS5 table and triggers

- [x] Create or preserve `messages_fts` with `porter unicode61` tokenizer
- [x] Ensure `messages_fts` uses `messages` as the content table
- [x] Ensure indexed columns are:
  - [x] `subject`
  - [x] `from_address`
  - [x] `to_addresses`
  - [x] `body_text`
- [x] Create or preserve insert, update, and delete triggers
- [x] Document any Effect SQL workaround needed for trigger `BEGIN`/`END` blocks

**File:** `src/server/db/migrations/0001_initial_schema.ts`
**Depends on:** Task 4
**Verify:** `bun run db:migrate`, `bun test src/server/db`

---

## Task 6: Wire migration and seed scripts

- [x] Update `scripts/migrate.ts` to load all DB migrations through `Migrator.fromRecord()`
- [x] Ensure `scripts/migrate.ts` uses the shared SQLite layer or matching connection settings
- [x] Ensure `scripts/seed.ts` still runs after the final schema is applied
- [x] Ensure seed data remains idempotent when accounts already exist
- [x] Ensure `scripts/dev.ts` runs migrations before seed

**Files:** `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/dev.ts`
**Depends on:** Task 3, Task 4
**Verify:** `bun run db:migrate`, `bun run db:seed`

---

## Task 7: Write database smoke tests

- [x] Create a colocated DB test using a temporary SQLite database file
- [x] Test that migrations create every required application table
- [x] Test that WAL mode is enabled
- [x] Test that foreign keys are enabled
- [x] Test that invalid foreign key inserts fail
- [x] Test that account + folder + message inserts succeed
- [x] Test that FTS finds inserted message content
- [x] Test that FTS update and delete triggers update the search index
- [x] Clean up the temporary database files created by the test

**File:** `src/server/db/client.test.ts`
**Depends on:** Task 4, Task 5, Task 6
**Verify:** `bun test src/server/db`

---

## Task 8: Validate local development bootstrap

- [x] Delete or move aside the local development database
- [x] Run migrations from a clean database state
- [x] Run seed from a clean database state
- [x] Confirm mock accounts, folders, messages, and attachments are queryable
- [x] Confirm FTS search returns seeded message matches
- [x] Run seed a second time and confirm it skips without duplicating data

**Files:** `data/localmail.db`, `scripts/migrate.ts`, `scripts/seed.ts`
**Depends on:** Task 6, Task 7
**Verify:** `bun run db:migrate`, `bun run db:seed`, `bun run db:seed`

---

## Final verification

- [x] `bunx tsc --noEmit` passes
- [x] `bun test` passes
- [x] `bun run db:migrate` passes
- [x] `bun run db:seed` passes
- [x] All output files exist per `plan.md`
- [x] No Drizzle dependencies, config, or scripts are present
- [x] Update `plan.md` status from `pending` to `done`
- [x] Update `docs/progress.md` feature status for 002

---

## Manual E2E Testing

- [x] Start from no `data/localmail.db`
- [x] Run `bun run dev`
- [x] Confirm `data/localmail.db` is created
- [x] Confirm migrations run before seeding
- [x] Confirm seed data exists after bootstrap
- [x] Confirm `/api/health` still responds from the development server

---

## Notes

- Use Effect SQL and `@effect/sql-sqlite-bun`; do not reintroduce Drizzle.
- Use `bun` for scripts and `bunx` for TypeScript checks.
- Keep database tests on temporary files so local development data is not mutated.
- Preserve the schema in `TECH_SPEC.md` §3.1 unless a new decision explicitly changes it.
- Effect SQL executed the static FTS trigger `BEGIN`/`END` blocks directly; no raw SQLite workaround was needed.
- During early solo development, keep one canonical `0001_initial_schema.ts` migration and reset `data/localmail.db` when the schema changes.
