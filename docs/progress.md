# Progress Log

Started: 2026-04-16

## Codebase Patterns

- Bun is the runtime, package manager, test runner, and dev entrypoint.
- Server code uses Effect with `@effect/platform-bun`.
- SQLite access and migrations use `@effect/sql-sqlite-bun`, per `docs/decisions.md`.
- `bun run dev` is the zero-config bootstrap: create data dir, migrate, seed, start Bun server, start Vite.
- Vite serves the client during development on `localhost:5173` and proxies API/WebSocket traffic to the Bun server on `localhost:4000`.

## Key Files

- `package.json` - project metadata, scripts, runtime/client/dev dependencies.
- `tsconfig.json` - strict TypeScript config and path aliases.
- `vite.config.ts` - React/Tailwind build config and dev proxy.
- `scripts/dev.ts` - local development bootstrap.
- `scripts/migrate.ts` - Effect SQL migration runner.
- `scripts/seed.ts` - idempotent mock data seed script.
- `src/server/index.ts` - Effect/Bun server entrypoint with health endpoint.
- `src/server/db/migrations/0001_initial_schema.ts` - initial SQLite schema migration.
- `src/server/db/client.ts` - shared SQLite layer and DB introspection helpers.
- `src/server/db/schema.ts` - typed database contracts and storage object names.
- `src/server/db/client.test.ts` - DB behavior tests for relationships, cascades, timestamp defaults, and FTS triggers.

---

## Phase 1 — Foundation (MVP)

### Feature Status

| #   | Feature                | Status  | Date       |
| --- | ---------------------- | ------- | ---------- |
| 001 | Project Scaffold       | done    | 2026-04-16 |
| 002 | Database Setup         | done    | 2026-04-19 |
| 003 | Effect Server          | pending |            |
| 004 | Gmail OAuth2           | pending |            |
| 005 | IMAP Sync Engine       | pending |            |
| 006 | API Routes (Read-Only) | pending |            |
| 007 | React Layout           | pending |            |
| 008 | Message List           | pending |            |
| 009 | Email Viewer           | pending |            |

---

## Phase 2 — Interaction

### Feature Status

| #   | Feature            | Status  | Date |
| --- | ------------------ | ------- | ---- |
| 010 | Outlook OAuth2     | pending |      |
| 011 | Message Actions    | pending |      |
| 012 | Compose + Send     | pending |      |
| 013 | Draft Support      | pending |      |
| 014 | Keyboard Shortcuts | pending |      |

---

## Phase 3 — Generic Accounts

### Feature Status

| #   | Feature          | Status  | Date |
| --- | ---------------- | ------- | ---- |
| 015 | Generic Accounts | pending |      |
| 016 | Autodiscovery    | pending |      |
| 017 | Manual Setup UI  | pending |      |

---

## Phase 4 — Real-Time + Search

### Feature Status

| #   | Feature        | Status  | Date |
| --- | -------------- | ------- | ---- |
| 018 | IMAP IDLE      | pending |      |
| 019 | WebSocket Hub  | pending |      |
| 020 | Poll Scheduler | pending |      |
| 021 | FTS Search     | pending |      |

---

## Phase 5 — Polish

### Feature Status

| #   | Feature              | Status  | Date |
| --- | -------------------- | ------- | ---- |
| 022 | Unified Inbox        | pending |      |
| 023 | Thread View          | pending |      |
| 024 | Contact Autocomplete | pending |      |
| 025 | Image Proxy          | pending |      |
| 026 | UI Polish            | pending |      |

---

## Implementation Log

(Entries added as features are completed. Format below.)

## 2026-04-19 03:23 - Database Decisions Documented

- **What was implemented:** Updated `docs/decisions.md` with the durable rules discovered during database setup: application DB access must use the shared SQLite layer so foreign keys are enabled per connection, and disposable local development databases can be reset while the project has no production data.
- **Files changed:**
  - `docs/decisions.md` (modified)
  - `docs/progress.md` (modified)
- **Verification:**
  - Documentation-only update; no code verification needed.
- **Learnings for future iterations:**
  - While the project has only throwaway local data, prefer one canonical migration plus a local DB reset over compatibility migrations.

## 2026-04-19 03:17 - Database Setup

- **What was implemented:** Completed the Effect SQL SQLite database layer. Added typed DB contracts, shared SQLite layer with `data/` creation plus WAL/foreign-key initialization, completed the initial schema with `sync_state`, wired migrate/seed scripts through the shared layer, and verified FTS5 triggers.
- **Files changed:**
  - `docs/feature/phase-01/002-database-setup/plan.md` (modified)
  - `docs/feature/phase-01/002-database-setup/tasks.md` (modified)
  - `docs/progress.md` (modified)
  - `scripts/migrate.ts` (modified)
  - `scripts/seed.ts` (modified)
  - `src/server/db/client.ts` (modified)
  - `src/server/db/schema.ts` (modified)
  - `src/server/db/schema.test.ts` (modified)
  - `src/server/db/migrations/0001_initial_schema.ts` (modified)
  - `src/server/db/client.test.ts` (new)
- **Verification:**
  - `bun install --frozen-lockfile`
  - `bunx tsc --noEmit`
  - `bun run build`
  - `bun test`
  - `bun run db:migrate`
  - `bun run db:seed`
  - Clean DB bootstrap by moving aside `data/localmail.db`, running migrate + seed twice, querying seeded counts, sync state rows, and FTS, then restoring the original DB.
  - `bun run dev` smoke test confirmed migrations ran before seeding and `/api/health` returned HTTP 200.
- **Learnings for future iterations:**
  - `@effect/sql-sqlite-bun` enables WAL by default, but foreign keys still need explicit per-connection initialization.
  - While data is disposable, schema changes can be squashed into `0001_initial_schema.ts` and `data/localmail.db` can be reset.
  - Effect SQL handled static SQLite trigger `BEGIN`/`END` bodies directly; no raw SQLite workaround was required for FTS triggers.

## 2026-04-19 02:55 - Project Scaffold Verified

- **What was implemented:** Confirmed and finalized the Phase 1 scaffold. Updated the 001 plan to match `docs/decisions.md`: Effect SQL replaces Drizzle, Bun server runs on `localhost:4000`, Vite runs on `localhost:5173`, and `scripts/dev.ts` owns the dev bootstrap. Added missing scaffold directories and placeholder exports.
- **Files changed:**
  - `docs/feature/phase-01/001-project-scaffold/plan.md` (modified)
  - `package.json` (modified)
  - `src/server/auth/providers/index.ts` (new)
  - `src/client/components/index.ts` (new)
  - `src/client/stores/index.ts` (new)
  - `src/client/hooks/index.ts` (new)
  - `src/shared/index.ts` (new)
  - `src/server/db/schema.test.ts` (new)
- **Verification:**
  - `bun install --frozen-lockfile`
  - `bun run typecheck`
  - `bun run build`
  - `bun test`
  - `bun run db:migrate`
  - `bun run db:seed`
  - `bun run dev` smoke test with `/api/health`
- **Learnings for future iterations:**
  - Treat `docs/decisions.md` as the current source of truth when it supersedes older Tech Spec references.

<!--
## YYYY-MM-DD HH:MM - Feature Name
- **What was implemented:** Brief description
- **Files changed:**
  - `path/to/file.ts` (new/modified)
- **Learnings for future iterations:**
  - Key insight or gotcha discovered during implementation
-->
