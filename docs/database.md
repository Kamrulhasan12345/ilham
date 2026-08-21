# Database reference

This page gives a summary of the DDL in [`../db/`](../db/README.md). The files
run in numeric order, from `00_init` to `05_post_load`. The comments inside those
files are correct. This page is a map, and it explains the reasoning that covers
more than one object.

For the layer split and the read-only rule, see
[`architecture.md`](architecture.md).

## Tables in each layer

### `staging` — temporary, deleted after the load

Eleven tables. Node flattens the structure into them. **SQL then does all the
semantic work** on the way to `corpus`. See
[`data-and-etl.md`](data-and-etl.md).

| Table | Contents |
|---|---|
| `book_manifest` | Slug to real titles. Loaded as data, so `collections` is correct on the first insert |
| `hadiths` | Flattened hadith records, with `chapter_seq` from the source order |
| `chain_rows` | Flattened chains. One row for each position |
| `mentions` | Narrator mentions in text order |
| `narrators` | Flattened narrator profiles |
| `rank_map` | Curated. Normalised grade string to rank code |
| `narrator_rank_override` | Curated. Grade claims for named persons |
| `lk_hadiths` | English text and the Arabic that attaches it |
| `name_index` | Normalised name to narrator, with the candidate count |
| `rejects` | Every row that a stage did not use, with a reason |
| `resolution_conflicts` | Positions where pass A and pass B disagree |

Four of these never reach `corpus`, and that is deliberate:

- `staging.mentions` — only resolution pass B reads it, and pass B runs while
  staging still exists. Nothing queries mentions at runtime.
- `staging.rank_map` — it maps a normalised grade string to a rank code. The ETL
  applies it one time to fill `narrators.rank_ibn_hajar` and
  `narrators.rank_dhahabi`. Narrators point at `rank_levels` **directly**, so the
  map is never on a read path. It stays in the DDL as the record of the mapping
  decisions. It then goes away with the rest of `staging`.

  The column `match_kind` is `exact` or `token`. It selects which matching pass
  uses the row. The rijal grades are compound verdicts, such as
  <span dir="rtl">ثقة حافظ فقيه , إمام حجة …</span>. The **first word** carries
  the judgement. Token rules therefore do most of the work, and exact rules are
  the exceptions to them.
- `staging.narrator_rank_override` — grade claims for one named person each, with
  a written `note`. These are necessary because the rijal literature does not
  grade the most eminent transmitters. It writes praise instead. Ibn Hajar on Abu
  Hurayra writes *"the noble Companion, memoriser of the Companions"*. See the
  four passes below.
- `staging.name_index` — it holds the candidate count that makes pass A safe.

### `corpus` — read-only after the load

| Table or view | Notes |
|---|---|
| `collections` | The books. `slug` matches the manifest filename. `title_ar` is required and `title_en` is optional |
| `chapters` | Belongs to a collection. Identity is `(collection_id, seq)`, never the title. A hadith's chapter is **nullable** |
| `hadiths` | The key is the Ifta `mainId`, a **natural key**. `hadith_num` is `text`, because compound numbers exist. The `matn_*` columns are nullable, and about 89% of rows have them. An index on the normalised matn helps the alignment join |
| `rank_levels` | The ordinal scale for rijal grades: `rank_code → (ordinal, weight 0..1)`. A higher ordinal is stronger. The map from raw string to code runs at load time and lives in `staging.rank_map` |
| `narrators` | The key is the Ifta `narrator_id`. The columns `name_norm` and `display_norm` are **generated** from `normalize_arabic(...)`. The schema stores each grade **twice**: `rank_*_raw` for display, and `rank_ibn_hajar` and `rank_dhahabi` for arithmetic. Those two point at `rank_levels`. The columns `rank_*_via` hold `E`, `T`, `S`, or `O`, and record **which pass** set the code. The flag `is_placeholder` marks a mubham row such as <span dir="rtl">[راو موضع إبهام]</span> |
| `isnad_links` | A **weak entity**. The key is `(hadith_id, sanad_no, position)`. One row holds one narrator position in one chain, in transmission order. Position 1 is the Companion and the last position is the compiler. A NULL `narrator_id` means unresolved. `resolution` holds `A`, `B`, `C`, or `X`. Each link has a `transmission_word`, and `transmission_norm` is generated from it so that the anʿana penalty matches the vocalised <span dir="rtl">عَنْ</span>. Each link also has `is_compiler` |
| `isnad_edges` | A **VIEW**, not a table. It gives teacher-to-student edges. It joins `isnad_links` to itself on `position = position + 1`. To store the edges and the paths together would invite drift |
| `hadith_translations` | Translated text. The key is `(hadith_id, lang)`, so there is one canonical translation for each language. The table is **source-tagged and not LK-specific**: LK is one optional feeder, and manual entries land in the same table. `match_via` records how the row was attached, with `E`, `P`, `6`, `4`, or `M`, strongest first. This column exists because LK and Ifta share no identifier, so every row is a text match. If the row is absent, the interface shows Arabic |
| `etl_metrics` | Every number that the report quotes. It survives the deletion of `staging` on purpose |

**Three tables were removed, and here is why.** `hadith_mentions` had only one
consumer, pass B, so it stays in staging. `hadith_subjects` had no feature, query,
or ETL step that referenced it. `rank_map` moved to `staging`.

An empty table kept "for the future" is exactly the redundancy that requirement 8
grades against. Note that `hadith_translations` is **not** in that group. It
supports a real reader feature. To cut the English import costs rows, not the
capability.

### `app` — OLTP, every runtime write

- **Identity.** `users` with IS-A specialization into `students`, `teachers`, and
  `admins`, through **table inheritance**. See
  [IS-A](#is-a-via-table-inheritance) below. Inheritance costs four guarantees,
  and the schema restores each one.
- **Study structure.** `circles`, `enrollments`, `study_sets`, `set_items`,
  `assignments`, and `progress`.
- **Activity.** `review_sessions`, `review_items`, and `notes`.
- **Derived and audit.** `student_stats`, which a trigger maintains, and
  `audit_log`, the shadow table for teacher overrides.

The table `assignment_targets` was removed. You can derive the *existence* of an
obligation from `assignments ⋈ enrollments ⋈ set_items`. The state for each
student now lives on `progress`. The next section explains it.

#### `app.progress` — the grain and the key

One row is one obligation. The grain is **(student, hadith, assignment)**.

A hadith assigned two times is two obligations. This happens with two circles, or
with the same set assigned again next term. The student discharges each one
separately, so there are two rows. Private study is a third row, with
`assignment_id IS NULL`. A later assignment never resets its mastery.

A NULL cannot sit in a primary key, and `assignment_id` is nullable. Identity is
therefore the surrogate `progress_id`, and uniqueness splits in two:

```sql
UNIQUE (student_id, hadith_id, assignment_id) WHERE assignment_id IS NOT NULL
UNIQUE (student_id, hadith_id)                WHERE assignment_id IS NULL
```

These two indexes set no limit. A student can hold rows for any number of
different hadiths. The indexes reject only a second copy of a triple that already
exists.

**Remember this consequence.** Anything that counts mastered hadiths must use
`count(DISTINCT hadith_id)`. If it does not, a hadith assigned two times counts
two times. This applies to `trg_progress_stats` and to query Q4.

A third index on `student_id` alone is **not optional**. The stats trigger reads
every row for one student on each insert. Both unique indexes above start with
`student_id`, but both are partial, so neither one serves an unfiltered scan.

#### IS-A through table inheritance

Each row lives in exactly one child table. The parent is a read surface that
scans the hierarchy. `FROM app.users` returns every user. `FROM ONLY app.users`
returns none. The expression `tableoid::regclass` names the subtype of any row.

PostgreSQL inherits columns, defaults, `NOT NULL`, and `CHECK`. It does **not**
inherit primary keys, unique constraints, indexes, foreign keys, or identity. The
schema restores each one on purpose:

| Not inherited | Restored by | Why it matters |
|---|---|---|
| Identity | `app.user_id_seq` and an inherited `DEFAULT nextval(...)` | An identity column gives NULL in a child and then fails `NOT NULL`. Without this you cannot insert a user at all. One sequence keeps `user_id` unique across the subtypes |
| Primary key | `ALTER TABLE <child> ADD PRIMARY KEY (user_id)` | Without a unique constraint on a child, **no foreign key can reference it**. This is what makes `circles`, `enrollments`, `progress`, `review_sessions`, and `student_stats` possible |
| Unique | `ALTER TABLE <child> ADD UNIQUE (email)` and the `assert_email_unique()` trigger | A per-table UNIQUE cannot stop one address from existing as a student and as a teacher. Login would then be ambiguous |
| Foreign key to the parent | The `assert_user_exists()` trigger | A foreign key to `app.users` is checked with `ONLY` semantics. It sees no child rows and rejects every real user |

A foreign key that points at a **subtype** needs no help. It carries the role rule
by itself. The constraint `circles.teacher_id REFERENCES app.teachers(user_id)`
makes a circle owned by an admin impossible. Only two references are truly
polymorphic — `study_sets.owner_id` and `notes.user_id` — and they use the
trigger.

The column `audit_log.changed_by` has no check, and that is deliberate. A trigger
writes the audit rows. A failed actor check there would roll back the legitimate
user write that the row records. The column is nullable and best-effort by
design.

## Routines

### `corpus.chain_strength(hadith_id) → numeric` — function, `STABLE`

A clear chain-quality value. In each sanad, take the **weakest link**. Across the
sanads, the **best one wins**.

The weight of one link:

- A graded narrator gives the rank weight. Use the **stricter** of the two
  scholars: `least(ibn_hajar.weight, dhahabi.weight)`.
- A named but ungraded narrator gives the neutral value `0.50`. Ungraded is not
  the same as criticised.
- A placeholder or an unresolved name gives `0.15`. A mubham weakens the chain.
- An anʿana link, <span dir="rtl">عن</span>, takes a penalty of `0.05`.
- The compiler position is excluded.

The function returns a value from 0 to 1. It returns NULL if the hadith has no
chain.

### `app.assign_study_set(circle, set, due)` — procedure

The procedure sends one assignment to every enrolled student. It creates the
`progress` rows. It then runs `COMMIT`.

It is a **procedure and not a function, exactly because it owns its
transaction**. A PostgreSQL function cannot run `COMMIT`.

It has **no `EXCEPTION` handler**, and that is deliberate. A `BEGIN … EXCEPTION`
block is a subtransaction. A `COMMIT` inside a subtransaction raises *"cannot
commit while a subtransaction is active"*. The handler made the procedure
impossible to call. An unhandled error already stops the call and rolls back
everything, which is the all-or-nothing behaviour that requirement 3 needs.

The `ON CONFLICT` clause names the partial index,
`… WHERE assignment_id IS NOT NULL`. It is defensive only. The `CROSS JOIN` of
two tables with primary keys cannot collide with itself.

Each `CALL` makes a **new** assignment. Two calls therefore make two obligations.
The procedure does not remove duplicates.

### `app.assert_user_exists()` and `app.assert_email_unique()` — trigger functions

These give the referential integrity that table inheritance cannot express. See
the [IS-A table](#is-a-via-table-inheritance).

`assert_user_exists` takes the column name as a trigger argument. One function
therefore serves every polymorphic reference, which requirement 8 asks for.

Both check existence only. There is no `ON DELETE` cascade, so the deletion of a
user is a concern for the application layer.

### `corpus.normalize_arabic(text)`

The function removes the diacritic marks and the tatweel. It unifies the alif
forms, the ta marbuta, and the ya. It trims the ends and removes punctuation at
the ends only.

The generated `name_norm` column, the matn index, and the ETL resolution all use
it.

## Triggers — on `app` writes only

| Trigger | Fires on | Effect |
|---|---|---|
| `trg_progress_stats` | Writes to `app.progress` | Recomputes the derived counts and stores them in `student_stats`. It uses `count(DISTINCT hadith_id)`. See the progress grain above |
| `trg_progress_audit` | A change of mastery | Adds a row to the `audit_log` shadow table. It reads the actor from `current_setting('ilham.user_id')`. The `row_key` is `progress_id`, because student and hadith together are no longer unique |
| `trg_{students,teachers,admins}_email` | A subtype insert, or an email update | Email uniqueness across the whole hierarchy, through `assert_email_unique` |
| `trg_study_sets_owner` and `trg_notes_user` | Polymorphic user references | They stand in for the foreign key to `app.users`, through `assert_user_exists` |

The corpus fires no trigger. The first two triggers are the graded pair for
requirement 4. The others exist only to restore the integrity that inheritance
removes.

## Analytical queries — Q1 to Q6 in the DDL

1. **Top narrators.** The hadith count for each narrator. Placeholders and
   compilers are excluded.
2. **Contested narrators.** Where the ordinals of Ibn Hajar and al-Dhahabi
   disagree, ordered by the size of the disagreement.
3. **Shared narrators** between the chains of two hadiths.
4. **Circle overview.** The teacher dashboard. It spans `app` and the student
   rows. It shows mastered against assigned, with a percentage. It uses
   `count(DISTINCT hadith_id)` throughout.
5. **Weakest chains** among the studied hadiths. It runs `chain_strength()` over
   `app.set_items` joined to the corpus.
6. **Assignment completion.** Owed against done, for one assignment. It counts
   obligations and not knowledge. A hadith already mastered under a different
   assignment is still outstanding here until the student works it.

## Design rules — deliberate and graded. Do not "fix" them

- **Isnad paths are explicit rows. Edges are derived.** Positions are
  first-class, so a chain walk is **aggregation and not recursion**. A
  `WITH RECURSIVE` rewrite would be artificial. `isnad_edges` is a view, not a
  stored table. A `teacher_narrator_id` self-reference could not model the
  many-to-many reality of several chains.
- **`assign_study_set` stays a procedure.** It owns its `COMMIT`. This is the
  deliberate difference between requirement 5 and requirement 6. Do not add an
  `EXCEPTION` handler. It makes the `COMMIT` illegal.
- **Rijal grades: raw strings for display, ordinals for arithmetic.** Keep both
  columns. Keep the three states apart: graded, named but ungraded, and unnamed.
  Computation goes from `narrators.rank_*` to `rank_levels` directly.
  `staging.rank_map` runs at load time only and is not on that path.
- **IS-A stays table inheritance**, with the compensating keys and triggers in
  place. If you remove one of them, integrity breaks in silence and raises no
  error. That is why each one is documented where it is defined.
- **`progress` is keyed by (student, hadith, assignment).** Count mastered
  hadiths with `DISTINCT`.
- **Translations attach by Arabic text, never by `hadith_num`.** The two sources
  number differently. Of the pairs that match on text, 99.94% of Muslim and
  31.96% of Bukhari carry a different number. A number join attaches the English
  of one hadith to a different hadith, and nothing detects it.
- **Triggers fire on `app` writes only.**
- **Each feature appears one time, where it belongs.** There are no duplicate
  routines, no runtime corpus writes, and no artificial recursion. Restraint is
  graded by requirement 8. Read PRD §5 before you add a routine.
