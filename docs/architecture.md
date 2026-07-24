# Architecture

Ilham deliberately runs two workloads that are usually separated by different
systems — an **analytical, read-only reference corpus** and a **transactional
study application** — inside a *single* PostgreSQL instance, separated by
**schema design** rather than by infrastructure. This is the central design
decision; understand it before touching anything.

## Why one instance, two workloads

The corpus (hadith texts, isnad chains, narrator gradings) is fixed reference
data: loaded once, never edited at runtime, queried analytically. The study
layer (circles, assignments, progress, reviews) is classic OLTP: many small
writes, transactions, triggers. Rather than stand up a warehouse plus an app
database, Ilham models the distinction with three schemas. The justification if
asked: single source, small scale, dual workload on one instance — separation by
schema design, not by systems.

## The three schemas

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL instance                                         │
│                                                              │
│  staging   ──ELT──▶   corpus   ◀── reads ──┐                 │
│  (transient)          (read-only)          │                 │
│                                            │ cross-layer     │
│                        app  ───────────────┘ reads only      │
│                        (OLTP, all runtime writes)            │
└─────────────────────────────────────────────────────────────┘
```

| Schema | Role | Lifetime / writes |
|---|---|---|
| `staging` | Flat, typed landing tables for the raw dataset load (no JSONB — Node flattens before SQL sees it) | Transient — `DROP`ped after the one-time load |
| `corpus` | Reference data: collections, chapters, hadiths, isnad links, narrators, gradings | Seeded once, then **writes revoked from the app role** |
| `app` | Users and the study layer | All runtime writes happen here |

### Read-only means read-only

The corpus is not "read-only by convention." After the load:

```sql
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA corpus FROM <app_role>;
DROP SCHEMA staging CASCADE;
```

So the corpus is read-only **by permission**. No application code path should
ever write to `corpus.*`. Triggers exist only on `app` tables; the corpus never
fires a trigger and never takes a runtime write.

## Cross-layer reads

The one place the two layers meet is **reads that span both** — e.g. the teacher
circle-overview query joins `app.enrollments`/`app.progress` against `app`
student rows, and the "weakest studied chains" query joins `app.set_items`
against `corpus.hadiths` and calls `corpus.chain_strength()`. These are pure
reads; there is no write that crosses the boundary. In the ERD set these
cross-layer relationships are drawn in red.

## Request flows (planned API)

```
Corpus seed (one-time, not a feature):
  raw JSON → staging flat typed tables → SQL transforms → corpus tables
  → resolution passes A/B → apply staging.rank_map → REVOKE + DROP staging

POST /assignments (teacher owns the circle):
  CALL app.assign_study_set(circle, set, due)   -- procedure owns its own txn

POST /review-sessions (student or teacher):
  BEGIN → insert session → insert review_items → update progress
        → [trg_progress_stats fires] → COMMIT / ROLLBACK

PATCH /progress (teacher override):
  set_config('ilham.user_id', …) → BEGIN → update → [trg_progress_audit] → COMMIT

GET /analytics/*, /narrators/:id, /hadiths/:id:
  pure reads over corpus (+ chain_strength); no transactions
```

Two distinct transaction-ownership styles are intentional: `assign_study_set` is
a **procedure** that owns its `COMMIT` (with no `EXCEPTION` handler — that would
open a subtransaction and make the `COMMIT` illegal), while the review-session flow
owns its transaction at the **API layer** (node-postgres `BEGIN/COMMIT/ROLLBACK`)
with triggers firing inside it. See [`database.md`](database.md) for the object
details and the invariants these flows depend on.

## Roles and visibility (planned app layer)

Three roles — student, teacher, researcher/admin — modeled as `app.users` with
IS-A specialization into `students` / `teachers` / `admins` via table
inheritance. Visibility is enforced in the query layer: students see only their
own study data, teachers see their circles, students never see each other, and
the corpus is readable by all authenticated users.

Inheritance is a deliberate modeling choice, and it is not free: Postgres does
not inherit primary keys, unique constraints, foreign keys or identity, so the
schema restores each one explicitly (a shared sequence, per-child keys, and two
trigger functions standing in for the FKs inheritance cannot express). One
payoff is that a foreign key to a *subtype* enforces the role rule by itself —
`circles.teacher_id REFERENCES app.teachers(user_id)` makes an admin-owned
circle impossible without a line of application code. See
[`database.md`](database.md#is-a-via-table-inheritance) for the full table of
what is lost and what restores it.
