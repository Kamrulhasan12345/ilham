# Ilham backend

The API layer over the sealed corpus and the study schema, built per
`docs/backend-prd.md`. Express 5 + TypeScript + `pg`, no ORM.

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

`npm run typecheck` runs `tsc --noEmit` over the whole tree.
`npm test` runs the `node --test` suite — see "Testing" below for what it
covers.

## Structure

Each domain lives under `src/modules/<name>/`, with up to four files:

- `*.interface.ts` — TypeScript types for DB rows and API responses.
- `*.model.ts` — raw SQL against the shared `pg.Pool`. Every value is a
  `$1, $2, …` placeholder; no interpolation of query values. No SQL leaves
  this file (PRD §2.1).
- `*.controller.ts` — reads the request, validates with zod, calls the
  model, shapes the response. Throws typed errors from `lib/errors.ts`.
- `*.routes.ts` — an `express.Router()`, mounted with its guard in `app.ts`.

`src/app.ts` builds the middleware chain and mounts every router — see PRD
§7.1 for why the order is load-bearing. `src/middleware/errorHandler.ts` is
the single place that maps a thrown error (typed, ZodError, or a raw
Postgres error code) to an HTTP response, per PRD §2.4's table.

## What the database owns vs. what this API owns (PRD §1)

This API never recomputes `chain_strength`, never writes `app.student_stats`
directly, and never re-checks teacher verification before an insert — those
are database triggers/functions/procedures, and duplicating them here is
exactly what PRD req 8 penalises. Concretely: `POST /circles` lets the insert
run and maps the trigger's `23514` to `403 teacher_not_verified`
(`middleware/errorHandler.ts`); registration relies on the
`assert_email_unique` trigger's `23505` rather than a pre-check, for the same
reason (a pre-check would be a TOCTOU race under concurrent registrations).

Reads cover the `corpus` schema (collections, chapters, hadiths, narrators,
chain strength). Writes go to the `app` schema only: authentication
(`app.users` hierarchy, refresh tokens), notes (owner-scoped), circles
(teacher-only create, verified-teacher trigger gate), and teacher verification
(admin-only). The `ilham_app` DB role holds no `INSERT`/`UPDATE`/`DELETE`
grant on `corpus.*`, so the read-only rule holds even if a route is added by
mistake.

**Not built yet**, per `docs/backend-prd.md` §5.5/§5.8-§5.10 and §8.2-§8.3:
study sets, assignments, review sessions, progress override, analytics, and
the `pg_trgm` search index (the current `GET /hadiths?q=` works via
`corpus.normalize_arabic` + `LIKE`, just without that index's speed). None of
this is stubbed — no route, module, or dead import references it — so it's a
clean addition whenever it's picked up, not a partial one to untangle.

## Database objects this API assumes exist

`app.refresh_tokens` (`db/06_refresh_tokens.sql`) — `lib/refreshToken.ts`
assumes this table exists already; it's applied as part of the `db/` bootstrap,
not by this backend.

## Testing

Two files cover what's actually implemented:

- **`src/app.test.ts`** — guard-prefix 401s for every mounted router,
  register validation (admin rejection, short password, duplicate email
  409), the full register→refresh→logout→refresh-fails cycle, login's
  timing-safe wrong-password/nonexistent-email behavior, login/register rate
  limiting, and **the permission test**: `INSERT INTO corpus.hadiths` as
  `ilham_app` asserts `42501`.
- **`src/authorization.test.ts`** — cross-role 403s (student→circle,
  student/teacher→verification queue, unverified-teacher→circle), 404-not-403
  object-level ownership on notes, teacher/admin-only student listing, and a
  full admin→verify→teacher→circle→enroll flow.
- **`src/middleware/rateLimit.test.ts`** — unit coverage of
  `resolveClientKey` (see below).
- **`src/config.test.ts`** — the cookie/origin validation `config.ts` does
  at startup.

Run them with:

```bash
npm test
```

`app.test.ts` and `authorization.test.ts` require a real, reachable `ilham`
database (no mocking layer) — every test hits `pool` directly for
setup/assertions alongside the HTTP calls. Copy `.env.example` to `.env`
first.

### The rate limiter keys on the real connection, not a client-supplied header

`express-rate-limit`'s default `keyGenerator` reads `req.ip`, which only
reflects `X-Forwarded-For` when `app.set('trust proxy', ...)` is configured.
Setting `trust proxy` unconditionally is worse: this deployment has nothing in
front of it, so the header is entirely client-supplied, and trusting it would
let one caller either share everyone else's bucket or dodge the limit by
sending a fresh value per request. `middleware/rateLimit.ts`'s
`resolveClientKey` instead keys on `req.socket.remoteAddress` by default, and
only reads `X-Forwarded-For` (its rightmost hop) when `TRUST_PROXY=1` opts in
for a deployment that actually has a trusted proxy in front of it.

## Open decisions this scaffold resolved one way

- **Revocable logout**: kept. `app.refresh_tokens` exists; `POST
  /auth/logout` deletes the row for that token. Refresh tokens are not
  rotated on use (consuming one only reads/validates it) — a repeat cost of
  the current design, not a gap introduced here.
- **First admin**: seed directly into `app.admins` (see
  `scripts/seed-demo-accounts.mjs`); no bootstrap endpoint exists in this API.
- **Un-verifying a teacher**: not implemented. `POST /teachers/:id/verify`
  only sets `is_verified = true`; no corresponding DELETE/unverify route.
