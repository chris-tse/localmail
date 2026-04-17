---
status: pending
---

# 003 — Effect Server Bootstrap

## Phase
1 — Foundation (MVP)

## Goal
Set up the Effect-powered Bun HTTP server with Layer composition, static file serving for the React SPA, and a health-check endpoint. This establishes the runtime that all API routes and services will plug into.

## Prerequisites
- 001-project-scaffold (dependencies, Vite config)
- 002-database-setup (DatabaseLayer)

## References
- `TECH_SPEC.md` §2 — architecture, process model
- `TECH_SPEC.md` §7.1 — HttpApi definition pattern
- `@effect/platform-bun` docs (in node_modules or Effect docs site)

## Scope

### 1. Create the server entrypoint
- Location: `src/server/index.ts`
- Use `BunHttpServer` from `@effect/platform-bun`
- Compose layers:
  - `DatabaseLayer` (from 002)
  - `HttpApiBuilder.layer(Api)` (API routes — initially just health check)
  - `HttpStaticServer` serving `dist/client/` (SPA mode with index.html fallback)
- Bind to `127.0.0.1:3000` (localhost only, per TECH_SPEC §9)
- Run inside `ManagedRuntime` or `Effect.runFork` with proper shutdown handling

### 2. Create the API definition shell
- Location: `src/server/api/definition.ts`
- Define the top-level `HttpApi.make("Localmail")` with a single health-check endpoint
- This file will be the shared API definition imported by both server and client
- Pattern:
  ```ts
  const HealthGroup = HttpApiGroup.make("health")
    .add(HttpApiEndpoint.get("check", "/health", { success: Schema.Struct({ status: Schema.String }) }))

  export const Api = HttpApi.make("Localmail").add(HealthGroup)
  ```

### 3. Implement the health-check handler
- Location: `src/server/api/health.ts`
- Return `{ status: "ok" }` — confirms the server is running
- Wire via `HttpApiBuilder.group(Api, "health", ...)`

### 4. Create the shared API export
- Location: `src/shared/api.ts`
- Re-export the API definition so the client can import it without pulling in server code

### 5. Set up graceful shutdown
- Handle `SIGINT` and `SIGTERM`
- Effect's `ManagedRuntime` should handle scope cleanup automatically
- Log startup and shutdown messages

### 6. Research: @effect/platform-bun specifics
- How `BunHttpServer` handles WebSocket upgrades (needed in Phase 4)
- How `HttpStaticServer` works for SPA mode (index.html fallback for client-side routing)
- How to configure CORS if needed (probably not — same origin)

## Verification
- `bun run dev` starts the server on `localhost:3000`
- `curl http://localhost:3000/health` returns `{ "status": "ok" }`
- Vite-built client files served at `localhost:3000/` (once built)
- Server shuts down cleanly on Ctrl+C
- `bunx tsc --noEmit` passes

## Output
- `src/server/index.ts`
- `src/server/api/definition.ts`
- `src/server/api/health.ts`
- `src/shared/api.ts`
