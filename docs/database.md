# Database reference

Summarizes [`../db/schema.sql`](../db/schema.sql). The DDL's inline comments are
authoritative; this page is a map plus the reasoning that spans multiple objects.
For the layer split and read-only enforcement see
[`architecture.md`](architecture.md).

## Tables by layer

### `staging` (transient — dropped after load)

`staging.hadiths`, `staging.chain_rows` (flattened `chain_of_narrators`),
`staging.mentions` (flattened `names` triples, text order),
`staging.narrators`, `staging.rank_map`. Node does structural flattening into
these; **all semantic shaping is done in SQL** on the way to `corpus`. See
[`data-and-etl.md`](data-and-etl.md).

Two of these are load-time only and deliberately never reach `corpus`:

- `staging.mentions` — sole consumer is resolution Pass B, which runs while
  staging still exists. Nothing queries mentions at runtime.
- `staging.rank_map` — `normalized raw rank string → rank_code`, curated during
  ETL and applied once to populate `narrators.rank_ibn_hajar` /
  `rank_dhahabi`. Narrators reference `rank_levels` **directly**, so the map is
  never on a read path. It stays in the DDL as the record of the mapping
  decisions (req 9), then drops with the rest of `staging`.

### `corpus` (read-only after seed)

| Table / view | Notes |
|---|---|
| `collections` | Books; `slug` maps to the manifest filename; `title_ar` required, `title_en` optional |
| `chapters` | Belongs to a collection; a hadith's chapter is **nullable** |
| `hadiths` | PK is the Ifta `mainId` (**natural key**). `hadith_num` is `text` (compound numbers exist). `matn_*` nullable (~88% split coverage). A normalized-matn index aids the LK/MIS alignment join |
| `rank_levels` | The ordinal scale for rijal grades: `rank_code → (ordinal, weight 0..1)`. Higher ordinal = stronger. The raw→code lookup is load-time and lives in `staging.rank_map` |
| `narrators` | PK Ifta `narrator_id`. `name_norm` is a **generated** column (`normalize_arabic(name)`). Grades stored **twice**: `rank_*_raw` (display) and `rank_ibn_hajar` / `rank_dhahabi` (FKs into `rank_levels`, for math). `is_placeholder` flags mubham `[راو موضع إبهام]` rows |
| `isnad_links` | **Weak entity**, PK `(hadith_id, sanad_no, position)`. One row per narrator position in a chain, propagation order (position 1 = Companion/source … last = compiler). `narrator_id` NULL = unresolved. `resolution` ∈ `A`/`B`/`X`. `transmission_word` and `is_compiler` per link |
| `isnad_edges` | **VIEW**, not a table — teacher→student edges derived by self-joining `isnad_links` on `position = position+1`. Storing edges *and* paths would invite drift (see below) |
| `hadith_translations` | Translated text, PK `(hadith_id, lang)` — one canonical translation per language. **Source-tagged, not LK-specific**: LK is one optional bulk feeder, manual entries land in the same table. Absent row → UI falls back to Arabic |

**Removed, and why** — `hadith_mentions` (only Pass B consumed it; kept in
staging instead), `hadith_subjects` (no feature, query or ETL referenced it),
`rank_map` (moved to `staging`, above). An empty table kept "for future" is the
redundancy req 8 grades against — but note `hadith_translations` is *not* in
that category: it backs a shipped reader feature, and cutting the LK import
costs rows, not the capability.

### `app` (OLTP — all runtime writes)

- Identity: `users` with IS-A specialization → `students` / `teachers` /
  `admins` via **table inheritance**. See [IS-A](#is-a-via-table-inheritance)
  below — inheritance costs four guarantees that are restored explicitly.
- Study structure: `circles`, `enrollments`, `study_sets`, `set_items`,
  `assignments`, `progress`.
- Activity: `review_sessions`, `review_items`, `notes`.
- Derived / audit: `student_stats` (trigger-maintained), `audit_log` (shadow
  table for teacher overrides).

`assignment_targets` was removed: obligation *existence* is fully derivable from
`assignments ⋈ enrollments ⋈ set_items`, and per-student state now lives on
`progress` (next section).

#### `app.progress` — grain and key

One row per **(student, hadith, assignment)**. A hadith assigned twice — two
circles, or the same set re-assigned next term — is two obligations the student
must discharge separately, so it is two rows; prior self-study is a third with
`assignment_id IS NULL`, and its mastery is never reset by a later assignment.

Because `assignment_id` is nullable and NULLs cannot sit in a PRIMARY KEY,
identity is the surrogate `progress_id` and uniqueness is split:

```sql
UNIQUE (student_id, hadith_id, assignment_id) WHERE assignment_id IS NOT NULL
UNIQUE (student_id, hadith_id)                WHERE assignment_id IS NULL
```

These cap nothing — a student may hold rows for any number of distinct hadiths.
They reject only a duplicate of an existing triple. **Consequence:** anything
counting mastered hadiths must use `count(DISTINCT hadith_id)`, or a hadith
assigned twice is counted twice. This applies to `trg_progress_stats` and Q4.

#### IS-A via table inheritance

Rows live in exactly one child; the parent is a read surface that scans the
hierarchy (`FROM app.users` returns every user, `FROM ONLY app.users` returns
none), and `tableoid::regclass` names any row's subtype.

Postgres inherits columns, defaults, `NOT NULL` and `CHECK` — but **not**
primary keys, unique constraints, indexes, foreign keys, or identity. Each is
restored deliberately:

| Not inherited | Restored by | Why it matters |
|---|---|---|
| Identity | `app.user_id_seq` + inherited `DEFAULT nextval(...)` | Identity columns yield NULL in children, failing `NOT NULL` — without this you cannot insert a user at all. One sequence keeps `user_id` unique across subtypes |
| Primary key | `ALTER TABLE <child> ADD PRIMARY KEY (user_id)` | No unique constraint on a child means **no FK may reference it** — this is what unblocks `circles`, `enrollments`, `progress`, `review_sessions`, `student_stats` |
| Unique | `ALTER TABLE <child> ADD UNIQUE (email)` + `assert_email_unique()` trigger | Per-table UNIQUE cannot stop one address existing as both a student and a teacher; login would be ambiguous |
| Foreign key to the parent | `assert_user_exists()` trigger | An FK to `app.users` is checked with `ONLY` semantics, so it sees no child rows and rejects every real user |

FKs pointing at a **subtype** need no compensation and carry the role rule for
free: `circles.teacher_id REFERENCES app.teachers(user_id)` makes it impossible
for an admin to own a circle. Only genuinely polymorphic references
(`study_sets.owner_id`, `notes.user_id`) use the trigger.

`audit_log.changed_by` is deliberately left unchecked — audit rows are written
from inside `trg_progress_audit`, so a failed actor check would roll back the
legitimate user write being recorded. It is nullable and best-effort by design.

## Routines

### `corpus.chain_strength(hadith_id) → numeric` (function, `STABLE`)

Transparent chain-quality metric. Per sanad, take the **weakest link**; the
**best sanad wins**. Per-link weight:

- graded narrator → the rank weight, using the **stricter** of the two scholars
  (`least(ibn_hajar.weight, dhahabi.weight)`);
- named but ungraded → neutral `0.50` (ungraded ≠ criticized);
- placeholder / unresolved → `0.15` (mubham weakens the chain);
- ʿanʿana (`عن`) transmission → `−0.05` penalty;
- compiler position excluded. Returns `0..1`, or NULL if no chains.

### `app.assign_study_set(circle, set, due)` (procedure)

Fans an assignment out to every enrolled student and initializes `progress`
rows, then `COMMIT`s. It is a **procedure, not a function, precisely because it
owns its transaction** (Postgres functions cannot `COMMIT`).

It carries **no `EXCEPTION` handler**, deliberately. A `BEGIN … EXCEPTION` block
is a subtransaction, and `COMMIT` inside one raises *"cannot commit while a
subtransaction is active"* — the handler made the procedure impossible to call.
An unhandled error already aborts and rolls back the whole call, which is the
all-or-nothing behaviour req 3 wants.

`ON CONFLICT` names the partial index (`… WHERE assignment_id IS NOT NULL`) and
is defensive: the `CROSS JOIN` of two PK'd tables cannot collide on its own.
Each `CALL` mints a **new** assignment, so calling twice deliberately creates two
obligations — it does not deduplicate.

### `app.assert_user_exists()` / `app.assert_email_unique()` (trigger functions)

Referential integrity that table inheritance cannot express — see the
[IS-A table](#is-a-via-table-inheritance). `assert_user_exists` takes the column
name as a trigger argument so one function serves every polymorphic reference
(req 8). Both enforce existence only: there is no `ON DELETE` cascade, so
deleting a user is an application-level concern.

### `corpus.normalize_arabic(text)`

Strips harakat/tatweel and unifies alef / ta-marbuta / ya variants. Used by the
generated `name_norm` column, the matn index, and ETL resolution.

## Triggers (on `app` writes only)

| Trigger | Fires on | Effect |
|---|---|---|
| `trg_progress_stats` | `app.progress` writes | Recompute-and-store derived counts into `student_stats`. Uses `count(DISTINCT hadith_id)` — see the progress grain above |
| `trg_progress_audit` | mastery changes | Append to `audit_log` shadow table; actor read from `current_setting('ilham.user_id')`. `row_key` is `progress_id`, since student+hadith is no longer unique |
| `trg_{students,teachers,admins}_email` | subtype insert / email update | Hierarchy-wide email uniqueness (`assert_email_unique`) |
| `trg_study_sets_owner`, `trg_notes_user` | polymorphic user refs | Stand in for the FK to `app.users` (`assert_user_exists`) |

The corpus never fires a trigger. The first two are the graded req-4 pair; the
rest exist solely to restore integrity that inheritance removes.

## Analytics queries (in the DDL as Q1–Q6)

1. **Top Narrators** — hadith count per narrator (placeholder + compiler excluded).
2. **Contested Narrators** — where Ibn Hajar and al-Dhahabi ordinals disagree,
   ordered by disagreement magnitude.
3. **Shared narrators** between two hadiths' chains.
4. **Circle overview** — teacher dashboard; spans `app` + student rows, mastered
   vs assigned with a percentage. `count(DISTINCT hadith_id)` throughout.
5. **Weakest chains** among studied hadiths — `chain_strength()` over
   `app.set_items` joined to `corpus`.
6. **Assignment completion** — owed vs done for one assignment. Counts
   obligations, not knowledge: a hadith already mastered under a different
   assignment is still outstanding here until worked.

## Design invariants (intentional and graded — do not "fix")

- **Isnad paths are stored explicitly; edges are derived.** Positions are
  first-class rows, so chain traversal is **aggregation, not recursion** — a
  `WITH RECURSIVE` rewrite would be artificial (PRD req 8). `isnad_edges` is a
  view, not a stored table; a `teacher_narrator_id` self-FK could not model the
  M:N-per-chain reality.
- **`assign_study_set` stays a procedure** (it owns its `COMMIT`). This is the
  deliberate req-5-vs-req-6 distinction. Do not add an `EXCEPTION` handler back
  — it makes the `COMMIT` illegal.
- **Rijal grades: raw strings for display, ordinals for math.** Keep both
  columns and the three-way distinction: graded / named-but-ungraded / unnamed.
  Computation goes `narrators.rank_* → rank_levels` directly; `staging.rank_map`
  is load-time only and is not on that path.
- **IS-A stays table inheritance**, with the compensating keys and triggers kept
  intact. Removing any of them silently breaks integrity rather than erroring —
  that is precisely why each is documented at its definition.
- **`progress` is keyed by (student, hadith, assignment).** Count mastered
  hadiths with `DISTINCT`.
- **Triggers fire on `app` writes only.**
- **Each feature appears once, where it belongs** — no redundant routines, no
  runtime corpus writes, no fake recursion. Restraint is graded (req 8); read
  PRD §5 before adding any routine.
