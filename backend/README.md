# Ilham backend

This is the API layer. It uses Hono on Node, and TypeScript. It talks to
PostgreSQL with the `pg` driver and raw parameterized SQL. There is no ORM.

## Setup

Get a local database first — `docker compose up -d db` from the repo root
(see the root `README.md`), or `./db/run_container.sh bootstrap`. Either one
creates `ilham_app` with the default local-dev password already, so no manual
DB step is needed.

```bash
cp .env.example .env    # defaults already match a freshly bootstrapped DB
npm install
npm run dev              # tsx watch, listens on :3000
```

## Structure

Each domain lives in its own folder under `src/modules/`. A folder holds
four files:

- `*.interface.ts` — TypeScript types for DB rows and API responses.
- `*.model.ts` — raw SQL queries against the shared `pg.Pool`. Every value
  goes through a `$1, $2, …` placeholder. No string interpolation of query
  values.
- `*.controller.ts` — reads the request, calls the model, shapes the
  response. Throws `NotFoundError` or `HTTPException` on bad input.
- `*.routes.ts` — the Hono router for the folder.

`src/app.ts` mounts each router and holds the one `onError` handler that
maps errors to HTTP status codes.

## Scope

This first pass only reads the `corpus` schema (collections, hadiths,
narrators, chain strength). It has no write routes. The `ilham_app` DB role
also has no `INSERT`/`UPDATE`/`DELETE` grant on `corpus.*`, so the read-only
rule holds even if a route is added by mistake.

## Notes

- `tsconfig.json` uses `NodeNext` module resolution. A relative import in a
  `.ts` file needs a `.js` extension, e.g.
  `import { pool } from '../../db/pool.js';`, even though the source file is
  `pool.ts`. This matches what the compiled output will resolve to.
- Env vars follow the same convention as `etl/`: discrete `PGHOST`,
  `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` — not a single
  `DATABASE_URL`.
