# Architecture

Ilham runs two different workloads in **one** PostgreSQL instance. The first
workload is an **analytical, read-only corpus**. The second workload is a
**transactional study application**. Most systems keep these two apart with
different infrastructure. Ilham keeps them apart with **schema design**.

This is the central decision of the project. Read this page before you change
anything.

## Why one instance and two workloads

The corpus holds hadith texts, isnad chains, and narrator grades. It is fixed
reference data. The pipeline loads it one time. Nobody edits it at runtime.
Queries against it are analytical.

The study layer holds circles, assignments, progress, and reviews. It is
ordinary OLTP work: many small writes, transactions, and triggers.

A warehouse plus a separate application database is the usual answer. Ilham uses
three schemas instead. The reason is the scale. There is one source, the data is
small, and the two workloads fit in one instance. Schema design separates them,
not different systems.

## The three schemas

```
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL instance                                        │
│                                                             │
│  staging   ──load──▶   corpus   ◀── reads ──┐               │
│  (temporary)           (read-only)          │               │
│                                             │ cross-layer   │
│                        app  ────────────────┘ reads only    │
│                        (OLTP, every runtime write)          │
└─────────────────────────────────────────────────────────────┘
```

| Schema | Job | Lifetime and writes |
|---|---|---|
| `staging` | Flat typed tables for the load. There is no JSONB, because Node flattens the data before SQL sees it | Temporary. Deleted after the one-time load |
| `corpus` | Reference data: collections, chapters, hadiths, isnad links, narrators, grades | Loaded one time. The app role then loses write permission |
| `app` | Users and the study layer | Every runtime write happens here |

### Read-only means read-only

The corpus is not read-only by convention. After the load, the database runs:

```sql
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA corpus FROM <app_role>;
DROP SCHEMA staging CASCADE;
```

The corpus is therefore read-only **by permission**. No application code may
write to `corpus.*`. Triggers exist on `app` tables only. The corpus fires no
trigger and takes no runtime write.

## Cross-layer reads

The two layers meet in one place only: **reads that span both**.

Two examples show the pattern:

- The circle overview for a teacher joins `app.enrollments` and `app.progress`
  against the student rows in `app`.
- The "weakest studied chains" query joins `app.set_items` against
  `corpus.hadiths` and calls `corpus.chain_strength()`.

Both are reads. No write crosses the boundary. The ERD set draws these
cross-layer edges in red. There are exactly four of them, and all four point at
`corpus.hadiths`.

## Request flows (the planned API)

```
Corpus load (one time, not a feature):
  raw files → staging flat typed tables → SQL transforms → corpus tables
  → resolution pass A and pass B → apply staging.rank_map
  → attach English text → REVOKE + DROP staging

POST /assignments (the teacher owns the circle):
  CALL app.assign_study_set(circle, set, due)   -- the procedure owns its transaction

POST /review-sessions (a student or a teacher):
  BEGIN → insert session → insert review_items → update progress
        → [trg_progress_stats fires] → COMMIT or ROLLBACK

PATCH /progress (a teacher override):
  set_config('ilham.user_id', …) → BEGIN → update → [trg_progress_audit] → COMMIT

GET /analytics/*, /narrators/:id, /hadiths/:id:
  reads over the corpus, and chain_strength. No transactions
```

The two flows own their transactions in two different ways. This is deliberate.

- `assign_study_set` is a **procedure**. It owns its `COMMIT`. It has no
  `EXCEPTION` handler, because a handler opens a subtransaction and makes the
  `COMMIT` illegal at run time.
- The review-session flow owns its transaction in the **API layer**. Node sends
  `BEGIN`, `COMMIT`, and `ROLLBACK`. The triggers fire inside that transaction.

See [`database.md`](database.md) for the objects and the rules that these flows
depend on.

## Roles and visibility (the planned application layer)

There are three roles: student, teacher, and researcher or admin. The schema
models them as `app.users` with IS-A specialization into `students`, `teachers`,
and `admins`. Table inheritance provides the specialization.

The query layer enforces visibility:

- A student sees only their own study data.
- A teacher sees their own circles.
- One student never sees another student.
- Every authenticated user can read the corpus.

Inheritance is a deliberate modelling choice, and it has a cost. PostgreSQL does
not inherit primary keys, unique constraints, foreign keys, or identity. The
schema restores each one: a shared sequence, keys on each child table, and two
trigger functions in place of the foreign keys that inheritance cannot express.

There is one clear benefit. A foreign key to a **subtype** enforces the role rule
by itself. The constraint `circles.teacher_id REFERENCES app.teachers(user_id)`
makes a circle owned by an admin impossible. It needs no application code.

See [`database.md`](database.md#is-a-via-table-inheritance) for the full table of
what inheritance loses and what restores it.
