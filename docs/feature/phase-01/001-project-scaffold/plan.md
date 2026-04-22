---
status: done
---

# 001 — Project Scaffold

## Phase

1 — Foundation (MVP)

## Goal

Set up the monorepo structure, install all Phase 1 dependencies, configure TypeScript, and create the basic file tree. `bun run dev` should fully bootstrap the local development environment — no manual steps beyond `bun install && bun run dev`.

## Prerequisites

- None (first task in the project)

## References

- `TECH_SPEC.md` §10 — project structure
- `TECH_SPEC.md` §11 — dependencies

## Scope

### 1. Configure package.json

- Update `package.json` with project metadata (`name: "localmail"`, etc.)
- Add scripts:
  - `dev` — single command that bootstraps everything (see §10 below)
  - `build` — client build (Vite) + tsc check
  - `test` — `bun test`
  - `db:generate` — `bunx drizzle-kit generate`
  - `db:migrate` — `bunx drizzle-kit migrate`
  - `db:push` — `bunx drizzle-kit push`
  - `db:studio` — `bunx drizzle-kit studio`
  - `db:seed` — seed the database with mock data for offline development
  - `typecheck` — `bunx tsc --noEmit`

### 2. Install server dependencies

- `effect`
- `@effect/platform`
- `@effect/platform-bun`
- `imapflow`
- `nodemailer`
- `mailparser`
- `drizzle-orm`
- `ulid`

### 3. Install client dependencies

- `react` + `react-dom`
- `@tanstack/react-query`
- `@tanstack/react-router`
- `zustand`
- `tailwindcss` (+ `@tailwindcss/vite` if using Vite)
- `tinykeys`

### 4. Install dev dependencies

- `typescript`
- `bun-types`
- `@types/react` + `@types/react-dom`
- `drizzle-kit`
- `vite` + `@vitejs/plugin-react`
- `@types/nodemailer`
- `@types/mailparser`

### 5. Configure TypeScript

- Update `tsconfig.json`:
  - `strict: true`
  - Path aliases: `@server/*`, `@client/*`, `@shared/*`
  - `jsx: "react-jsx"`
  - Target/module appropriate for Bun

### 6. Configure Vite

- Create `vite.config.ts`:
  - React plugin
  - Tailwind CSS plugin
  - Output to `dist/client/`
  - Proxy API requests to Bun server in dev mode

### 7. Create directory skeleton

Create empty directories and placeholder `index.ts` files per TECH_SPEC §10:

```
src/server/db/
src/server/api/
src/server/setup/
src/server/sync/
src/server/auth/
src/server/auth/providers/
src/server/ws/
src/server/providers/
src/shared/
src/client/components/
src/client/stores/
src/client/hooks/
data/
scripts/
```

### 8. Create .env.example

Document development/build-time environment variables:

- `GOOGLE_CLIENT_ID` (optional contributor/release-build override for the Localmail-owned OAuth desktop client; not required for mock-data development)
- `ENCRYPTION_KEY` (optional — derived from machine if not set)

Do not document `GOOGLE_CLIENT_SECRET` as part of the shipped Gmail desktop flow. Installed apps cannot keep a client secret confidential; Gmail OAuth uses PKCE instead.

### 9. Update .gitignore

Add:

- `data/*.db`
- `dist/`
- `.env`
- `.env.local`

### 10. `bun run dev` bootstraps everything

The `dev` script must be zero-config — a fresh clone should work with just `bun install && bun run dev`. The script should:

1. **Create `data/` directory** if it doesn't exist
2. **Run DB migrations** — create/update the SQLite schema automatically
3. **Seed mock data** if the database is empty (no accounts exist):
   - Create 1-2 fake accounts (no real IMAP connection needed)
   - Create a handful of folders (Inbox, Sent, Drafts, Trash) per account
   - Insert 20-50 realistic mock messages with subjects, senders, dates, body text/HTML
   - Insert some with `is_read = 0`, some starred, some with attachments metadata
   - This gives the UI something to render without any IMAP setup
4. **Start the Bun server** with hot reload (`--hot`)
5. **Start Vite dev server** (for HMR on the client) — either as a subprocess or via Vite's middleware mode

The seed data is for development only. The app should work fully offline with this mock data — browsing folders, reading messages, toggling flags (local DB only, no IMAP).

### 11. Create the seed script

- Location: `scripts/seed.ts`
- Idempotent: skip if accounts already exist
- Generate realistic-looking email data:
  - Mix of read/unread, starred/not
  - Various senders with realistic names
  - Dates spread across the last 30 days
  - Some plain-text, some HTML body
  - A few with attachment metadata (no real files)
  - Some reply chains (shared thread_id, In-Reply-To headers)
- Use this for UI development before any IMAP code exists

## Verification

- `bun install` succeeds with no errors
- `bun run dev` on a fresh clone:
  - Creates `data/localmail.db`
  - Runs migrations
  - Seeds mock data
  - Starts server on `localhost:3000`
  - Health endpoint responds
- `bunx tsc --noEmit` passes
- Directory structure matches TECH_SPEC §10
- Mock data is visible when querying the DB directly

## Output

- Updated `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `.env.example`
- Updated `.gitignore`
- Directory skeleton under `src/`
- `scripts/seed.ts`
- Dev bootstrap logic in `src/server/index.ts` (or a separate `scripts/dev.ts`)
