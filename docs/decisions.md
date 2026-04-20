# Project Decisions

## 2026-04-16

### Effect-TS as the server runtime framework
Using `effect` + `@effect/platform-bun` as the core server framework instead of Hono + tRPC + Zod.
**Why:** An email client is a long-lived process with multiple concurrent IMAP connections,
reconnection logic, token refresh races, and resource cleanup on shutdown. Effect provides
structured concurrency (fibers), typed error channels, resource lifecycle (`Scope`/`Layer`),
composable retry/scheduling, and `PubSub` — all of which are load-bearing for IMAP. The
alternative would be hand-rolling all of this with try/catch, setInterval, and manual state
management. Effect also replaces three separate packages: Hono (HTTP → `BunHttpServer`),
tRPC (type-safe API → `HttpApi`), and Zod (validation → `effect/Schema`).

### Effect HttpApi over tRPC
Using Effect's `HttpApi` + `HttpApiGroup` + `HttpApiEndpoint` for the API layer instead of tRPC.
**Why:** `HttpApi` provides type-safe endpoints with typed error channels, and the client
(`HttpApiClient`) is derived from the same API definition — no separate client package needed.
This eliminates `@trpc/server`, `@trpc/client`, and `@trpc/react-query` from the dependency
tree. The API definition lives in a shared module importable by both server and client.
**Risk:** `HttpApi` is imported from `effect/unstable/httpapi` — the `unstable` prefix means
the API surface may still move. Pin the Effect version and monitor for breaking changes.

### effect/Schema over Zod
Using `effect/Schema` for all validation instead of Zod.
**Why:** Effect's Schema module integrates natively with `HttpApi` endpoints and is used
throughout the Effect ecosystem. Using Zod alongside Effect would mean maintaining two
validation systems. Schema provides branded types, encoding/decoding, and composable
transformations that work with the rest of Effect.

### Bun as the sole runtime
Using Bun for everything: runtime, package manager, bundler, test runner, SQLite (`bun:sqlite`).
**Why:** The project's core principle is zero external services. Bun provides built-in SQLite
(no `better-sqlite3`), built-in WebSocket support (no `ws`), auto `.env` loading (no `dotenv`),
and a fast bundler. Keeps the dependency tree minimal.

### Vite for client bundling, HttpStaticServer for serving
Using Vite to build the React client into `dist/`, served by Effect's `HttpStaticServer`.
**Why:** Effect's `BunHttpServer` already owns the port — it handles API routes, WebSocket
upgrades, and OAuth callbacks. `HttpStaticServer` serves the SPA from the same server process.
Vite provides the dev experience (fast HMR, CSS modules, source maps, Tailwind plugin) that
Bun's HTML imports don't yet match.

### @effect/sql-sqlite-bun over Drizzle ORM
Using Effect's native SQL layer (`@effect/sql-sqlite-bun`) instead of Drizzle ORM.
**Why:** Effect's SQL layer integrates naturally with the rest of the Effect ecosystem —
`SqlClient` is a service accessed via `yield*`, transactions compose with Effect's
resource management, and the migrator uses `Migrator.fromRecord()` with Effect-based
migration files. This avoids a split where HTTP/concurrency uses Effect patterns but
DB access uses a separate ORM with its own conventions. Drizzle Kit also required
`better-sqlite3` as a dev dependency for migrations, adding unnecessary weight.
The schema has 7 tables, FTS5, cursor pagination, and joins — manageable with Effect's
tagged template SQL and `SqlSchema` for typed queries.
**Decision date:** 2026-04-16, during 001-project-scaffold implementation.

### Electrobun for future desktop distribution
Planning to wrap the web app in Electrobun for desktop distribution (Phase 5+).
**Why:** Electrobun uses Bun as its native runtime — no sidecar, no second runtime. The web
UI works in any browser as a fallback. CEF mode available per-webview if native webview
rendering is inconsistent for HTML email. The architecture (Bun server + web UI) makes the
wrapper the most swappable layer — if Electrobun causes problems, Electron with a Bun sidecar
remains an option.
**Risk:** Electrobun is v1 (Feb 2026), thin ecosystem. Mitigated by deferring until Phase 5+
and keeping the web app fully functional standalone.

### Single server process, browser-based UI for development
During development (Phases 1-4), the app runs as a Bun server at `localhost:4000` and users
open it in a browser. No desktop wrapper needed until polish phase.
**Why:** Simplifies the development loop. The architecture already enforces clean separation
(HTTP API + WebSocket) so migrating to a desktop wrapper later requires zero code changes —
just a config change for where HTML/JS/CSS are loaded from.

### OAuth2 redirect via main server callback
Using `/auth/callback` on the main server for OAuth2 redirects (Q1 option b).
**Why:** Simpler UX and single code path vs. a temporary listener on a random port.

### Composite cursor pagination
Using composite `(date, ULID)` cursors for message list pagination (Q6 option b).
**Why:** Date-only cursors break when multiple messages share a timestamp. ULID tiebreaking
is deterministic and aligns with the ULID-based primary keys.

### Flat list default with thread toggle
Defaulting to flat message list, with thread view as a toggle (Q7 option a).
**Why:** Simpler initial implementation. Thread view is Phase 5 polish.

### Optimistic updates for flag changes
Using optimistic updates when toggling read/unread, star, etc. (Q8 option a).
**Why:** Email clients feel sluggish without optimistic UI. TanStack Query's `onMutate` /
`onError` rollback pattern handles this cleanly.

### Offline-first local development with mock data
`bun run dev` on a fresh clone fully bootstraps the dev environment: creates the DB, runs
migrations, seeds realistic mock data, and starts the server. No IMAP credentials, no OAuth
setup, no `.env` configuration needed to start developing the UI.
**Why:** The UI (Phases 1-2) can be built and iterated on entirely offline. IMAP/SMTP
integration is complex and shouldn't block frontend development. Mock data includes read/unread
messages, starred messages, reply chains, and attachment metadata — enough to exercise every
UI state. When IMAP code lands, the same seed script serves as a fallback for developers
who don't want to connect a real account during development.

### Autodiscovery: presets + MX + autoconfig + heuristics
Building full autodiscovery pipeline for generic accounts (Q9 option b).
**Why:** Good UX without Exchange-style complexity. Effect's `orElse` chaining and
`raceAll` for heuristic probing make the implementation clean.

## 2026-04-20

### Google OAuth credentials distribution for desktop
Localmail uses a Localmail-owned Google Cloud project and OAuth desktop client for Gmail
authorization. Packaged desktop builds include the public Google OAuth client ID, but do not
ship or require a Google client secret. Users should never create their own Google Cloud
project just to connect Gmail.
**Why:** Localmail is installed on the user's machine, so anything bundled with the app can be
extracted and cannot be treated as a confidential secret. Google's installed-app flow is the
intended model for this: open the system browser, use a loopback redirect URI, and protect the
authorization-code exchange with PKCE (`S256`). The Google client ID identifies Localmail; it
is not a password. Gmail's restricted scopes still require Localmail-owned OAuth consent
configuration, verification, and release gating before broad public use.
**Implications:**
- `GOOGLE_CLIENT_ID` is build/developer configuration, not an end-user setup step.
- `GOOGLE_CLIENT_SECRET` is not used by the shipped desktop Gmail flow.
- OAuth must open in the system browser, not an embedded app webview.
- Development can use test users on the Localmail-owned OAuth app until verification is complete.
