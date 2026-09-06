# Ilham backend

The API layer over the sealed corpus and the study schema, built per
`docs/backend-prd.md`. Express 5 + TypeScript + `pg`, no ORM.

## Setup

You need a running PostgreSQL 16 database with the `corpus` and `app`
schemas already loaded (see the companion `db/` project — this repo does not
create them). The app connects as `ilham_app`, which has SELECT-only on
`corpus.*` and read-write on `app.*`.

```bash
cp .env.example .env    # defaults match a freshly bootstrapped local DB
npm install
npm run dev              # tsx watch, listens on :3000
```

`npm run typecheck` runs `tsc --noEmit` over the whole tree.
`npm test` runs the (currently empty) `node --test` suite — see "Testing"
below for what the PRD asks you to add first.

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
exactly what PRD req 8 penalises. Three places this shows up concretely:

- `POST /circles` lets the insert run and maps the trigger's `23514` to
  `403 teacher_not_verified` (`middleware/errorHandler.ts`).
- `POST /assignments` calls `CALL app.assign_study_set($1,$2,$3)` via a
  plain `pool.query` — **never** wrapped in `withTransaction`, since the
  procedure owns its own `COMMIT` (PRD §5.8).
- `GET /students/:id/stats` reads `app.student_stats` read-only; it is never
  written from this codebase.

## Database objects this API assumes exist

Per PRD §8, four additions belong to the database side, not this backend:

1. `app.refresh_tokens` (§8.1) — this API's `lib/refreshToken.ts` assumes
   this table exists already.
2. The `pg_trgm` trigram index on `corpus.hadiths` (§8.2) — `GET /hadiths?q=`
   assumes it; without it the search still works, just slowly.
3. `db/06_queries.sql`'s six analytics views/function (§8.3) — the
   `analytics`, `circles` (Q4), and `assignments` (Q6) modules `SELECT` from
   `corpus.v_top_narrators`, `corpus.v_contested_narrators`,
   `corpus.shared_narrators(a,b)`, `corpus.v_weakest_chains`,
   `app.v_circle_overview`, and `app.v_assignment_completion` respectively.
   **These do not exist until that SQL file is written and run** — those six
   endpoints will 42P01 (undefined table) against a database that hasn't
   had it applied.
4. Per-sanad strength (§8.4, optional) — not yet surfaced in
   `GET /hadiths/:id`; `chains[].strength` is currently always `null`. Add
   either `corpus.sanad_strength(hadith, sanad_no)` or a view, then fill
   this in `hadiths.model.ts`.

## Testing

The PRD (§7.2, §11 week 8) asks for four tests as the minimum bar. All four
exist, plus substantially more, across five files:

- **`src/app.test.ts`** — guard-prefix 401s for every mounted router,
  register validation (admin rejection, short password, duplicate email
  409), the full register→refresh→logout→refresh-fails cycle, login's
  timing-safe wrong-password/nonexistent-email behavior, a rate-limiter
  regression test (see below), and **the permission test**: `INSERT INTO
  corpus.hadiths` as `ilham_app` asserts `42501`.
- **`src/authorization.test.ts`** — cross-role 403s (student→circle,
  student/teacher→verification queue, unverified-teacher→circle), 404-not-403
  object-level ownership on notes and study sets, teacher/admin-only student
  listing, and a full admin→verify→teacher→circle→enroll→assign flow.
- **`src/modules/assignments/assignments.test.ts`** — the three PRD §5.8
  procedure rules: calling `POST /assignments` twice creates two rows (not a
  conflict), ownership is checked *before* the `CALL` (a rejected attempt
  leaves zero rows), and `GET /assignments/:id/completion` is owner-only.
- **`src/modules/reviews/reviews.test.ts`** — the mastery arithmetic
  (`pass` caps at 4, `partial` holds, `fail` floors at 0,
  `times_reviewed` always increments), the self-study progress row match
  (`assignment_id IS NOT DISTINCT FROM`), multi-item sessions, and
  session visibility.
- **`src/modules/progress/progress.test.ts`** — the override flow: owner can
  override, self-study rows (`assignment_id IS NULL`) are refused with 422,
  a non-owning teacher gets 403, `trg_progress_audit`'s `changed_by` is
  checked, and the admin-only audit log.

Run them with:

```bash
npm test
```

This requires a real, reachable `ilham` database (no mocking layer, matching
the demo scaffold's own approach) — every test hits `pool` directly for
setup/assertions alongside the HTTP calls. Copy `.env.example` to `.env`
first. Two endpoints depend on `db/06_queries.sql` having been applied
(`GET /assignments/:id/completion`, and transitively the analytics module);
if those specific tests fail with a 500/`42P01` instead of the expected
status, that SQL file — not the code — is what's missing.

### A bug this test suite caught

Writing `assignments.test.ts`'s "ownership checked before the CALL" case
required the test helpers to spoof distinct IPs via `X-Forwarded-For` to
avoid tripping the 5-per-minute login/register limiter across many rapid
registrations. Running the suite the first time revealed that
`express-rate-limit`'s **default** `keyGenerator` reads `req.ip`, which only
reflects `X-Forwarded-For` when `app.set('trust proxy', ...)` is configured
— without it, every request in the process (and, in production, every user
behind one shared reverse proxy) collapsed onto a single bucket. Fixed in
`auth.routes.ts` with an explicit `keyGenerator`, and pinned with a
dedicated regression test in `app.test.ts` ("the limiter keys by
X-Forwarded-For, not the shared test-runner socket address") so it can't
silently reappear.

## Open decisions this scaffold resolved one way (PRD §12)

- **Revocable logout**: kept. `app.refresh_tokens` exists; `POST
  /auth/logout` deletes the row for that token.
- **Does a review carry `assignment_id`?**: yes, in the request body only,
  exactly as PRD §5.9 recommends. Absent/null means self-study, matched with
  `assignment_id IS NOT DISTINCT FROM $3`.
- **Per-sanad strength**: not yet implemented (see above) — recommend the
  view, per §8.4.
- **Does a student self-review?**: yes, but only for themselves — enforced
  in `reviews.controller.ts`.
- **Circle/assignment deletion**: not implemented. No delete route exists
  for either, matching the PRD's "the safe answer is no" recommendation.
- **First admin**: seed directly into `app.admins`; no bootstrap endpoint
  exists in this API, per §3.3/§12.6.
- **Un-verifying a teacher**: not implemented. `POST /teachers/:id/verify`
  only sets `is_verified = true`; no corresponding DELETE/unverify route.
