# Ilham — backend PRD

**The API layer over the sealed corpus and the study schema**
**Stack:** PostgreSQL 16 · Hono (Node 18+, TypeScript) · `pg`
**Status:** DRAFT for agreement. The DDL is final. This document adds no table
and changes no design rule.
**Companion files:** `docs/prd.md` (the product), `db/01_corpus.sql` and
`db/02_app.sql` (the objects), `backend/src/` (the current scaffold)

This document uses ASD-STE100 Simplified Technical English.

---

## 0. What exists, and what this adds

`backend/` holds a scaffold. It has three modules — collections, hadiths,
narrators — a `pg` pool, a pagination helper, and one error class. It reads the
corpus. It has no authentication, no study layer, and no analytics.

This document specifies the complete API. It keeps the scaffold's shape:
`routes.ts` → `controller.ts` → `model.ts` → `interface.ts` for each module.

The API adds **no new business rule to the database**. Every routine the course
grades is already in the DDL. The backend calls them.

---

## 1. Principles

1. **The database owns the rules. The API owns the flow.** The API never
   recomputes `chain_strength`, never maintains `student_stats`, and never fans
   an assignment out by itself.
2. **The backend connects as `ilham_app`.** The `REVOKE` in `05_post_load.sql`
   is then load-bearing. A write to `corpus.*` fails with a permission error, not
   with a code review.
3. **One feature, one place** (PRD req 8). An analytics query lives in SQL, one
   time. The model file selects from it.
4. **Arabic is canonical. English is optional.** Every response that carries
   text carries the Arabic and a nullable English. The frontend falls back.
5. **A derived row says how it was derived.** The corpus records `resolution`,
   `rank_*_via` and `match_via`. The API passes them through. It never hides
   them.

---

## 2. Cross-cutting contracts

### 2.1 Response envelope

The scaffold returns bare arrays. **Change this now**, while only three modules
exist. A list response returns:

```json
{ "data": [ ... ], "page": { "limit": 20, "offset": 0, "total": 14901 } }
```

A single-object response returns `{ "data": { ... } }`. The envelope lets the
frontend page a list without a second endpoint, and it lets a later field
addition stay compatible.

### 2.2 Errors

One shape, always:

```json
{ "error": { "code": "not_found", "message": "hadith not found" } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `bad_request` | A parameter fails validation |
| 401 | `unauthenticated` | No token, or the token is not valid |
| 403 | `forbidden` | The token is valid, but the role or the ownership rule refuses |
| 404 | `not_found` | The row does not exist, **or** the caller may not see it |
| 409 | `conflict` | A unique constraint refuses the write |
| 422 | `unprocessable` | The request is well-formed but the state refuses it |
| 500 | `internal_error` | Anything else. The message is generic |

**403 against 404.** A student who asks for another student's progress gets
**404**, not 403. A 403 confirms that the row exists. Use 403 only where the
caller may know the row exists — for example, a teacher who is not the owner of
a circle they can see in a list.

Never return a PostgreSQL error message to the client. Map the SQL state:
`23505` → 409, `23503` → 422, `42501` (permission denied) → 500 with an alarm in
the log, because that means the corpus lockdown caught a bug.

### 2.3 Pagination

Keep `limit` and `offset`. Default limit 20, maximum 100. Every list endpoint
returns `page.total` from a second `count(*)` over the same predicate.

### 2.4 Language

`?lang=en` selects the translation. The default is `en`. The Arabic is always
present in the response. A missing translation gives `"translation": null`, and
the frontend shows Arabic. Do not substitute Arabic into an English field.

### 2.5 Validation

Add **zod**. Every controller parses `params`, `query` and `body` through a
schema before it calls the model. A validation failure raises 400 with the field
name. This replaces the hand-written `parseOptionalInt` in the scaffold.

### 2.6 CORS

The React frontend runs on a different port in development. Add `hono/cors`,
with the allowed origin in the configuration.

---

## 3. Authentication (reqs 1 and 2)

### 3.1 Mechanism

**Stateless JWT.** In-house, with `jsonwebtoken` and `bcryptjs`.

- `POST /auth/login` returns an access token. Lifetime 15 minutes.
- The refresh token is an opaque random string in an `httpOnly` cookie.
  Lifetime 7 days.
- The claims are `sub` (user_id), `role`, `iat`, `exp`. Nothing else. The role
  is in the token, so a guard needs no database round trip.
- The secret comes from the environment. The server refuses to start without it.

The refresh token needs storage to be revocable. **This is the one table the
backend must add**: see §8.1. If you decide that logout may be client-side only,
drop the table and say so in the report — that is an acceptable scope cut for a
term project, but state it.

### 3.2 The guard

One middleware, `requireAuth`. It reads `Authorization: Bearer <token>`,
verifies it, and puts `{ userId, role }` on the Hono context. A second
middleware, `requireRole('teacher', 'admin')`, checks the role.

Every route except `/auth/login`, `/auth/register` and `/health` sits behind
`requireAuth`. Mount the guard on the router, not on each route — a route that a
person forgets to guard is the failure mode this design must not have.

### 3.3 Registration

`POST /auth/register` inserts into `app.students`, `app.teachers` or
`app.admins` — the child table, never `app.users`. `app.users` has no rows of
its own; it is the parent of the hierarchy. An insert into the parent creates a
user with no subtype and no role attributes.

The `assert_email_unique` trigger refuses an email that already exists under
another subtype. Map its `unique_violation` to 409.

Open the teacher and admin roles only to an admin, or seed them. A public
endpoint that mints teachers defeats the whole visibility model.

---

## 4. Visibility rules

The query layer enforces these. They are predicates, not opinions.

| Caller | Sees |
|---|---|
| Student | `WHERE student_id = :me` on progress, reviews and stats. Their own sets and notes. Circles they are enrolled in |
| Teacher | Circles where `teacher_id = :me`, and everything under them: enrollments, assignments, the progress of enrolled students |
| Admin | Everything |
| Any authenticated user | The whole corpus |

**One student never sees another.** A teacher sees a student's progress only
through a circle they own.

Write the predicate in the model function, not in the controller. A controller
that forgets a filter leaks data; a model that always takes `caller` cannot.

---

## 5. Endpoint catalogue

`A` = requires authentication. `S` / `T` / `Ad` = student / teacher / admin.

### 5.1 Auth

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Body carries `role`. Inserts into the subtype table |
| POST | `/auth/login` | — | Returns the access token, sets the refresh cookie |
| POST | `/auth/refresh` | — | Reads the cookie, returns a new access token |
| POST | `/auth/logout` | A | Deletes the refresh token |
| GET | `/auth/me` | A | The caller's own row, including the subtype attributes |

### 5.2 Corpus — read-only

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/collections` | A | `collection_id, slug, title_ar, title_en` |
| GET | `/collections/:id/chapters` | A | Ordered by `seq`. Include `hadith_count` |
| GET | `/chapters/:id/hadiths` | A | Paged |
| GET | `/hadiths` | A | Filters: `collection_id`, `chapter_id`, `q`. See §5.3 |
| GET | `/hadiths/:id` | A | The detail. See below |
| GET | `/narrators/:id` | A | The profile, the grades, both raw and coded |
| GET | `/narrators/:id/hadiths` | A | Paged. The chains the narrator appears in |
| GET | `/narrators` | A | Search by name. `q` matches `name_norm` or `display_norm` |

**`GET /hadiths/:id` — the shape the frontend needs.** The scaffold already
returns most of it. Add three things:

```jsonc
{
  "hadith":  { "hadith_id": 1, "hadith_num": "1", "text_plain": "…",
               "text_diac": "…", "matn_plain": "…", "sanad_count": 1 },
  "collection": { "slug": "sahih-al-bukhari", "title_ar": "…", "title_en": "…" },
  "chapter":    { "chapter_id": 12, "seq": 12, "title_ar": "…" },
  "translation": { "lang": "en", "text_full": "…", "source": "LK",
                   "match_via": "E" },          // null when absent
  "chains": [                                    // GROUPED by sanad_no
    { "sanad_no": 1,
      "strength": 0.95,                          // per-sanad, see §8.3
      "links": [
        { "position": 1, "narrator_id": 4021, "display_name": "…",
          "name_en": "…", "raw_name": "…", "transmission_word": null,
          "is_compiler": false, "resolution": "A",
          "rank_ibn_hajar_raw": "…", "rank_ibn_hajar": "thiqa" }
      ] } ],
  "chain_strength": 0.95,
  "chain_strength_basis": { "words_aligned": true, "sanad_count": 1 }
}
```

Three changes against the scaffold, and each one matters:

- **Group the links by `sanad_no`.** A flat list makes the frontend regroup
  them, and a hadith with four sanads renders as one impossible 22-person chain.
- **Carry the rank on the link.** The narrator panel needs it, and a second
  round trip for each of 5.4 positions is 5.4 queries per hadith.
- **Carry `chain_strength_basis`.** §3.2 of the corpus review measures that
  multi-sanad hadiths carry **no** transmission words at all, so the anʿana
  penalty cannot fire for them. The number is not comparable between hadiths
  unless the reader can see this. One boolean makes an unstated flaw a stated
  limitation.

**Query count.** The scaffold runs four queries for one hadith. Fold them into
two: one for the hadith with its collection, chapter and translation joined; one
for the links with the narrator and the rank levels joined. Call
`corpus.chain_strength` in the first one.

### 5.3 Corpus search

`GET /hadiths?q=<arabic>` matches the normalised text:

```sql
WHERE corpus.normalize_arabic(text_plain) LIKE '%' || corpus.normalize_arabic($1) || '%'
```

The existing index (`normalize_arabic(left(matn_plain, 200))`) is a B-tree on an
expression. It serves equality and prefix only. It cannot serve this query.

**Add a trigram index.** See §8.2. `pg_trgm` gives real substring search over
Arabic. It is the correct choice here, and the reason is worth one line in the
report: PostgreSQL ships no Arabic stemmer, so `tsvector` would use the `simple`
configuration and degrade to exact-word matching with more machinery.

Normalise the search term with the same function the index uses. If the two
differ, the index is never used and nothing tells you.

### 5.4 Analytics (req 7)

**These queries do not exist yet.** `docs/prd.md` §5 says six are written in the
DDL. A search of `db/*.sql` finds one assertion line in the smoke test. This is
the largest open gap in the project.

Write them in a new `db/06_queries.sql`, as **views**, and grant `SELECT` to
`ilham_app`. The model file then selects from the view with a `LIMIT`. This
keeps req 7 true (the query is in the DDL), keeps req 8 true (it exists one
time), and keeps the API thin.

| Q | Endpoint | Object | Notes |
|---|---|---|---|
| Q1 | `GET /analytics/top-narrators` | `corpus.v_top_narrators` | Count of chain positions per narrator. Exclude `is_compiler` and `is_placeholder` |
| Q2 | `GET /analytics/contested-narrators` | `corpus.v_contested_narrators` | `rank_levels.ordinal` differs between the two scholars. **Exclude `rank_*_via = 'S'`** — pass S sets both columns from one tabaqa rule, so those narrators are not contested, they are unjudged |
| Q3 | `GET /analytics/shared-narrators?a=&b=` | `corpus.shared_narrators(a, b)` | Two hadiths, the narrators in common. A view cannot take a parameter and the self-join over 117k links is not materialisable, so this one is a SQL function |
| Q4 | `GET /circles/:id/overview` | `app.v_circle_overview` | The teacher dashboard. Per student: assigned, mastered, overdue. `count(DISTINCT hadith_id)` |
| Q5 | `GET /analytics/weakest-chains` | `corpus.v_weakest_chains` | Ordered by `chain_strength`. Join to the collection and the chapter for display |
| Q6 | `GET /assignments/:id/completion` | `app.v_assignment_completion` | Per student: due, done, percentage |

Q4 and Q6 are views in `app`, filtered by the caller's circle in the model. Q1,
Q2, Q3 and Q5 read the corpus only.

`GET /analytics/*` needs no special role. A student may read the corpus
analytics. Q4 and Q6 sit under `/circles` and `/assignments`, where the
ownership rule applies.

### 5.5 Circles and enrolment

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/circles` | A | A teacher sees the circles they own. A student sees the circles they are in |
| POST | `/circles` | T | `teacher_id` comes from the token, never from the body |
| GET | `/circles/:id` | A + member | 404 for a non-member |
| PATCH | `/circles/:id` | T + owner | Rename only |
| GET | `/circles/:id/students` | T + owner | |
| POST | `/circles/:id/students` | T + owner | Body `{ student_id }`. 409 on a repeat |
| DELETE | `/circles/:id/students/:sid` | T + owner | Leaves the progress rows. Deleting them destroys the audit trail |
| GET | `/circles/:id/overview` | T + owner | Q4 |

**`teacher_id` never comes from the body.** It comes from the token. A body
field here is a horizontal privilege escalation, and it is the first thing an
examiner tries.

### 5.6 Study sets

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/study-sets` | A | Owned by the caller |
| POST | `/study-sets` | A | `owner_id` from the token. The `assert_user_exists` trigger checks it |
| GET | `/study-sets/:id` | A + owner | With the items joined to the hadith |
| PATCH | `/study-sets/:id` | A + owner | Rename |
| DELETE | `/study-sets/:id` | A + owner | Refuse with 422 if an assignment references it |
| POST | `/study-sets/:id/items` | A + owner | `{ hadith_id }`. 409 on a repeat |
| DELETE | `/study-sets/:id/items/:hid` | A + owner | |

A teacher owns the sets they assign. A student owns their own. `owner_id` is
polymorphic, so the trigger, not a foreign key, checks it.

### 5.7 Assignments (req 6)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/assignments` | A | A student sees theirs. A teacher sees the ones in their circles |
| POST | `/assignments` | T + owner of the circle | **`CALL app.assign_study_set($1, $2, $3)`** |
| GET | `/assignments/:id` | A + visible | |
| GET | `/assignments/:id/completion` | T + owner | Q6 |

**The procedure owns its transaction.** Three rules follow, and each one is a
real failure if you break it:

1. **Do not open a transaction around the `CALL`.** The `COMMIT` inside the
   procedure fails with *"invalid transaction termination"* when a transaction
   block is already open.
2. **Check the ownership before the `CALL`, not after.** The procedure commits.
   There is nothing to roll back.
3. **Test this in week 3 with the real driver.** A procedure with transaction
   control can refuse to run under the extended query protocol that `pg` uses
   for a parameterised query. If it does, validate the three integers, then send
   the `CALL` as a simple query. Find this out early, not in week 8.

Calling twice creates **two** assignments and two sets of obligations. This is
correct and deliberate. Do not add a "already assigned" check.

### 5.8 Review sessions (req 3)

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/review-sessions` | A | The API owns the transaction |
| GET | `/review-sessions` | A | Visibility per §4 |
| GET | `/review-sessions/:id` | A + visible | With the items |

Body:

```json
{ "student_id": 12, "circle_id": 3, "assignment_id": 45,
  "items": [ { "hadith_id": 101, "result": "pass" } ] }
```

The flow, on **one pooled client**:

```
client = await pool.connect()
BEGIN
  INSERT INTO app.review_sessions  → session_id
  INSERT INTO app.review_items     (one multi-row insert)
  UPDATE app.progress              (see the rule below)
  [trg_progress_stats fires per row]
COMMIT   (or ROLLBACK on any error)
client.release()
```

This is the explicit multi-table transaction the checklist asks for. Do not use
`pool.query` for the steps — each call may take a different connection, and the
`BEGIN` then applies to a connection that does no work.

**Open decision — which progress row does a review update?** `app.review_sessions`
carries `student_id`, `reviewer_id` and `circle_id`. It does **not** carry
`assignment_id`. The grain of `app.progress` is `(student, hadith, assignment)`.
So a student with two assignments plus self-study on one hadith has three
progress rows, and the schema does not say which one a review discharges.

The seed already gets this wrong: `seed.js:198-203` updates by
`(student_id, hadith_id)` with no assignment predicate, so one review bumps every
row including the private-study one. That breaks the invariant the seed exists to
demonstrate.

**Recommendation.** Take `assignment_id` in the request body, not in the schema.
The API then updates exactly one row per item:

```sql
UPDATE app.progress
   SET mastery = …, times_reviewed = times_reviewed + 1, last_reviewed = now()
 WHERE student_id = $1 AND hadith_id = $2
   AND assignment_id IS NOT DISTINCT FROM $3
```

When `assignment_id` is absent, the review is self-study and the target is the
`assignment_id IS NULL` row. Insert that row if it does not exist. This needs no
schema change, no ERD change, and no new document.

**The mastery rule.** State it once, in the model, with a comment:

| `result` | Effect on `mastery` |
|---|---|
| `pass` | `least(mastery + 1, 4)` |
| `partial` | unchanged |
| `fail` | `greatest(mastery - 1, 0)` |

`times_reviewed` always increases by one. Do not put this rule in a trigger.
`trg_progress_stats` derives the counts; the pedagogy belongs to the API. Two
routines that both write mastery is exactly what req 8 penalises.

### 5.9 Progress and the teacher override (req 4b)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/progress` | A | Filters `student_id`, `assignment_id`. Visibility per §4 |
| GET | `/students/:id/stats` | A + self or teacher | Reads `app.student_stats`. Never recompute it |
| PATCH | `/progress/:progressId` | T + owner of the circle | `{ mastery }`. Fires the audit trigger |
| GET | `/audit-log` | Ad | Paged, newest first |

**The override flow, on one pooled client:**

```
client = await pool.connect()
BEGIN
  SELECT set_config('ilham.user_id', $userId, true)
  UPDATE app.progress SET mastery = $1 WHERE progress_id = $2
  [trg_progress_audit fires]
COMMIT
client.release()
```

**Use `true`, not `false`, for the third argument.** The comment at
`db/02_app.sql:296` shows `false`. `false` makes the setting persist on the
connection after the request ends. The next request that takes that connection
from the pool inherits a stale actor, and the audit log attributes a teacher's
override to whoever used the connection last. With `true` the setting is
transaction-local and resets at `COMMIT`. Fix the comment in the DDL as well.

**A teacher may not override self-study.** If the target row has
`assignment_id IS NULL`, refuse with 422. That row belongs to the student alone.

The audit row is best-effort by design: `changed_by` is nullable and the trigger
does not check it. Do not add a check — a failure there rolls back the
legitimate write it is recording.

### 5.10 Notes

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/hadiths/:id/notes` | A | The caller's own notes on that hadith |
| POST | `/hadiths/:id/notes` | A | `user_id` from the token |
| PATCH | `/notes/:id` | A + owner | |
| DELETE | `/notes/:id` | A + owner | |

`notes.user_id` is polymorphic. The `assert_user_exists` trigger checks it.

### 5.11 Operations

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/health` | — | Database reachable, and the corpus row counts |
| GET | `/meta/etl-metrics` | A | Reads `corpus.etl_metrics`. This is the report's evidence, served |

`/meta/etl-metrics` costs ten lines and it demonstrates the whole ETL story in
the defence. It is the cheapest endpoint in this document.

---

## 6. Transaction ownership — the three patterns

The project uses three, and the difference is graded (reqs 3 and 6).

| Pattern | Where | Who commits |
|---|---|---|
| **No transaction** | Every `GET` | Autocommit. A read needs none |
| **The procedure commits** | `POST /assignments` | `app.assign_study_set`. The API must not open a block |
| **The API commits** | `POST /review-sessions`, `PATCH /progress` | Node sends `BEGIN`, `COMMIT`, `ROLLBACK` on one client |

Write one helper, `withTransaction(fn)`, that takes a client from the pool,
sends `BEGIN`, runs the callback, commits, rolls back on a throw, and always
releases. Use it for the two API-owned flows. Do **not** use it for the
procedure call.

---

## 7. Module layout

Keep the scaffold's shape. Add these modules:

```
src/
  middleware/   auth.ts  requireRole.ts  errorHandler.ts
  lib/          jwt.ts  password.ts  transaction.ts  pagination.ts  errors.ts
  modules/
    auth/  collections/  hadiths/  narrators/  analytics/
    circles/  studySets/  assignments/  reviews/  progress/  notes/  meta/
```

`model.ts` holds SQL and takes the caller. `controller.ts` validates and maps.
`routes.ts` mounts the guard. `interface.ts` holds the types. No SQL leaves a
model file.

---

## 8. Database work the backend needs

Four items. All are additive. None changes a design rule.

### 8.1 The refresh-token table

```sql
CREATE TABLE app.refresh_tokens (
    token_hash text PRIMARY KEY,          -- sha256 of the token, never the token
    user_id    integer NOT NULL,          -- polymorphic -> trigger, like notes
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.refresh_tokens (user_id);
CREATE TRIGGER trg_refresh_user BEFORE INSERT OR UPDATE OF user_id
ON app.refresh_tokens FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('user_id');
```

Store the hash, not the token. Reuse `assert_user_exists`; do not write a second
one. If you cut revocable logout, delete this table and record the cut.

### 8.2 The search index

`pg_trgm` is an extension, and `CREATE EXTENSION` needs a superuser. The corpus
is already sealed, so this runs as the database owner, in a new file:

```sql
-- db/06_search.sql — run once, after the ETL, as the owner
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX hadiths_text_trgm_idx ON corpus.hadiths
    USING gin (corpus.normalize_arabic(text_plain) gin_trgm_ops);
```

`normalize_arabic` is `IMMUTABLE`, so the expression index is legal.

Two operational notes. `05_post_load.sql` is destructive and runs one time, so
the index cannot go there — it needs its own numbered file. And `db/ilham.dump`
must be regenerated afterwards, or a fresh clone gets a corpus with no search
index and no error.

### 8.3 The six analytics queries

`db/06_queries.sql`, as described in §5.4. This is the biggest single deliverable
in this document and it belongs to the corpus owner.

### 8.4 Per-sanad strength (optional)

`corpus.chain_strength` returns the best sanad. The detail page wants the value
for each sanad. Either add `corpus.sanad_strength(hadith, sanad_no)`, or expose
the per-sanad `min` in a view. Prefer the view — req 8 grades restraint, and a
second function that duplicates the first one's arithmetic is the kind of thing
this project has otherwise avoided.

---

## 9. Requirement map

| Req | Where it lands in the API |
|---|---|
| 1–2 | `/auth/*`, `requireAuth`, `requireRole`. Every router carries a guard |
| 3 | `POST /review-sessions` and `PATCH /progress`. `withTransaction` sends `BEGIN`/`COMMIT`/`ROLLBACK` |
| 4a | Fires under `POST /review-sessions`. The API never writes `student_stats` |
| 4b | `PATCH /progress`, with `set_config('ilham.user_id', …, true)` first |
| 5 | `GET /hadiths/:id` calls `corpus.chain_strength`. `GET /analytics/weakest-chains` orders by it |
| 6 | `POST /assignments` calls the procedure. No transaction block around it |
| 7 | `/analytics/*`, `/circles/:id/overview`, `/assignments/:id/completion` |
| 8 | Analytics live in SQL one time. Mastery lives in the API one time. No corpus write path exists |
| 9 | Every model function is one query with one comment that names its rule |

---

## 10. Ownership

The split follows `docs/prd.md` §7.

- **The teammate:** `auth/`, the two middlewares, `circles/`, `studySets/`,
  `assignments/`, Q4 and Q6, and the `student_stats` read path.
- **You:** `collections/`, `hadiths/`, `narrators/`, `analytics/` with Q1, Q2, Q3
  and Q5, `reviews/`, `progress/` with the override, `meta/`, and the search
  index.
- **The seam:** `reviews/`. Your transaction fires their stats trigger. Agree
  the request body in week 5 and do not change it after.

---

## 11. Build order

| Week | Backend | Gate |
|---|---|---|
| 3 | Envelope, errors, zod, CORS. Auth and the guards. **Test the procedure call** | `curl` logs in and reads a guarded route |
| 4 | Circles, enrolment, study sets, assignments | A teacher assigns a set and progress rows appear |
| 5 | Review sessions, progress, the override. `withTransaction` | The stats trigger and the audit trigger both fire from HTTP |
| 6 | `db/06_queries.sql`, the analytics endpoints, `/meta/etl-metrics` | Six queries answer over HTTP |
| 7 | Search index, hadith detail v2, per-sanad strength, notes | The frontend has everything it needs |
| 8 | Hardening: rate limit on login, request logging, the permission test | A `ilham_app` write to `corpus` fails, on camera |

**The permission test.** Write one test that tries
`INSERT INTO corpus.hadiths` as `ilham_app` and asserts that it fails with
`42501`. It proves the lockdown in two seconds during the defence.

---

## 12. Open decisions

1. **Revocable logout?** If no, drop §8.1 and record the cut.
2. **Does a review carry `assignment_id`?** §5.8 recommends yes, in the body
   only. Agree this before week 5 — it is the seam between the two halves.
3. **Per-sanad strength: view or function?** §8.4 recommends the view.
4. **Does a student self-review?** The schema allows it — `reviewer_id` is
   nullable. If yes, a student may `POST /review-sessions` for themselves only.
   If no, restrict the endpoint to a teacher and say why.
5. **Does `DELETE` exist for a circle or an assignment?** Both have progress and
   audit rows under them. The safe answer is no, and a `is_archived` flag is a
   schema change. Recommend: no delete, and say so.
