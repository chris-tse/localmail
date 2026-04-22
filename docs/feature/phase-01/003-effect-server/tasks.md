# 003 Effect Server Bootstrap — Tasks

Each task below is independently executable. Tasks are ordered by dependency.
Status key: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` skipped/cancelled.

---

## Task 1: Confirm server prerequisites and package APIs

- [ ] Verify `src/server/db/client.ts` exports the database layer used by the server entrypoint (`SqliteLive`)
- [ ] Verify the installed `effect` and `@effect/platform-bun` versions expose the expected `HttpApi`, `HttpApiBuilder`, `BunHttpServer`, and `HttpStaticServer` modules
- [ ] Document any API naming differences in this task file or update `plan.md` before implementing

**Files:** `src/server/db/client.ts`, `package.json`, `docs/feature/phase-01/003-effect-server/plan.md`
**Depends on:** None
**Verify:** `bunx tsc --noEmit` reaches only existing implementation errors, not unresolved package/module errors

---

## Task 2: Create the HttpApi definition shell

- [ ] Create `src/server/api/definition.ts`
- [ ] Define `HealthGroup` with a `GET /health` endpoint named `check`
- [ ] Define the success schema as `{ status: string }` using `effect/Schema`
- [ ] Export `Api = HttpApi.make("Localmail").add(HealthGroup)`

**File:** `src/server/api/definition.ts`
**Depends on:** Task 1
**Verify:** `bunx tsc --noEmit` validates the API definition imports and schema shape

---

## Task 3: Implement the health handler layer

- [ ] Create `src/server/api/health.ts`
- [ ] Implement the `health` group with `HttpApiBuilder.group(Api, "health", ...)`
- [ ] Return `{ status: "ok" }` from the `check` handler
- [ ] Keep the handler free of database dependencies so it can be used as a process liveness check

**File:** `src/server/api/health.ts`
**Depends on:** Task 2
**Verify:** `bunx tsc --noEmit` validates the handler against the API definition

---

## Task 4: Export the shared API contract

- [ ] Replace the placeholder in `src/shared/api.ts` with a re-export of the API definition
- [ ] Ensure the shared export does not import server runtime code, database code, or handler layers
- [ ] Keep the import path compatible with the existing Vite aliases

**File:** `src/shared/api.ts`
**Depends on:** Task 2
**Verify:** `bunx tsc --noEmit` passes without client-side imports pulling in Bun server-only modules

---

## Task 5: Wire the Effect server entrypoint

- [ ] Replace the temporary raw `HttpRouter` health route in `src/server/index.ts`
- [ ] Compose the API implementation layer, `HttpApiBuilder.layer(Api)`, `SqliteLive`, and the Bun HTTP server layer
- [ ] Bind the server to host `127.0.0.1` and port `4000`
- [ ] Add startup logging that includes the listening URL
- [ ] Keep the entrypoint compatible with `bun --hot src/server/index.ts` from `scripts/dev.ts`

**File:** `src/server/index.ts`
**Depends on:** Tasks 2, 3, 4
**Verify:** `bunx tsc --noEmit` passes

---

## Task 6: Serve built client assets with SPA fallback

- [ ] Add `HttpStaticServer` serving `dist/client/`
- [ ] Configure SPA fallback to `index.html` for client-side routes
- [ ] Ensure API routes take precedence over static routes
- [ ] Decide and document the expected behavior when `dist/client/` does not exist during development

**File:** `src/server/index.ts`
**Depends on:** Task 5
**Verify:** `bunx vite build`, then `bun src/server/index.ts` serves `http://localhost:4000/`

---

## Task 7: Add graceful shutdown handling

- [ ] Handle `SIGINT` and `SIGTERM`
- [ ] Ensure the Effect runtime scope is interrupted or disposed on shutdown
- [ ] Log shutdown start and completion messages
- [ ] Confirm shutdown does not leave the Bun server process running

**File:** `src/server/index.ts`
**Depends on:** Task 5
**Verify:** Start `bun src/server/index.ts`, press Ctrl+C, and confirm the process exits cleanly

---

## Task 8: Write server smoke tests

- [ ] Create a focused server/API smoke test if the current Effect HTTP API can be tested without a long-lived process
- [ ] Test that the health handler returns `{ status: "ok" }`
- [ ] Test that the shared API export loads without importing the server entrypoint
- [ ] If a process-level test is required, keep it isolated so it does not conflict with port `4000`

**Files:** `src/server/api/health.test.ts`, `src/shared/api.test.ts`
**Depends on:** Tasks 2, 3, 4
**Verify:** `bun test` passes

---

## Final verification

- [ ] `bunx tsc --noEmit` passes
- [ ] `bun test` passes
- [ ] `bun run build` passes
- [ ] `bun run dev` starts the server and Vite dev server
- [ ] `curl http://localhost:4000/health` returns `{ "status": "ok" }`
- [ ] Built client files are served from `http://localhost:4000/`
- [ ] All output files exist per `plan.md`
- [ ] Update `docs/feature/phase-01/003-effect-server/plan.md` status from `pending` to `done`
- [ ] Update `docs/progress.md` feature 003 status and implementation log

---

## Manual E2E Testing

- [ ] Start `bun run dev`
- [ ] Open `http://localhost:5173/` and confirm the Vite app can reach the server through the `/api` proxy
- [ ] Run `curl http://localhost:4000/health` and confirm the JSON health response
- [ ] Run `bun run build` and then `bun src/server/index.ts`
- [ ] Open `http://localhost:4000/` and confirm the built SPA loads
- [ ] Navigate directly to a client-side route under `http://localhost:4000/` and confirm the SPA fallback serves `index.html`
- [ ] Stop the server with Ctrl+C and confirm a clean shutdown log

---

## Notes

- The original 003 plan referenced port `3000`; current project decisions and Vite proxy config use server port `4000`.
- The database plan has evolved from Drizzle to `@effect/sql-sqlite-bun`; the server should depend on `SqliteLive`, not a Drizzle `DatabaseLayer`.
- `src/server/index.ts` currently contains a temporary raw health route at `/api/health`; implementing this task list should replace it with the planned `HttpApi` route at `/health`.
- Keep tasks atomic and independently verifiable.
- Use `bun` for running scripts, `bunx` for CLI tools.
