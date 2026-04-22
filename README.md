# localmail

Local-first email client prototype built with Bun, Effect, SQLite, Vite, React, and Tailwind.

The current repo contains the project scaffold, local SQLite schema/migrations, seed data, an Effect/Bun server with a health endpoint, and a Vite client shell. Feature plans and implementation progress live under `docs/`.

## Requirements

- [Bun](https://bun.com)

## Setup

```bash
bun install
cp .env.example .env
```

## Development

```bash
bun run dev
```

The dev script creates `data/` when needed, runs migrations, seeds mock data, and starts:

- Vite client: `http://localhost:5173`
- Bun API server: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

## Useful Scripts

```bash
bun run typecheck
bun run build
bun test
bun run db:migrate
bun run db:seed
```

While the project only uses disposable local data, `bun run db:clean` removes the local SQLite database files.

## Docs

- `TECH_SPEC.md` - product and architecture spec
- `docs/decisions.md` - current implementation decisions
- `docs/progress.md` - feature status and implementation log
- `docs/feature/` - per-feature plans and tasks
