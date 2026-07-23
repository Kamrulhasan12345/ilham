# Database reference

Summarizes [`../db/schema.sql`](../db/schema.sql). The DDL's inline comments are
authoritative; this page is a map plus the reasoning that spans multiple objects.
For the layer split and read-only enforcement see
[`architecture.md`](architecture.md).

## Tables by layer

### `staging` (transient — dropped after load)

`staging.hadiths`, `staging.chain_rows` (flattened `chain_of_narrators`),
`staging.mentions` (flattened `names` triples, text order),
`staging.narrators`. Node does structural flattening into these; **all semantic
shaping is done in SQL** on the way to `corpus`. See
[`data-and-etl.md`](data-and-etl.md).

### `corpus` (read-only after seed)

| Table / view | Notes |
|---|---|
| `collections` | Books; `slug` maps to the manifest filename; `title_ar` required, `title_en` optional |
| `chapters` | Belongs to a collection; a hadith's chapter is **nullable** |
| `hadiths` | PK is the Ifta `mainId` (**natural key**). `hadith_num` is `text` (compound numbers exist). `matn_*` nullable (~88% split coverage). A normalized-matn index aids the LK/MIS join |
| `rank_levels` | The ordinal scale for rijal grades: `rank_code → (ordinal, weight 0..1)`. Higher ordinal = stronger |
| `rank_map` | `normalized raw rank string → rank_code`. Curated during ETL |
| `narrators` | PK Ifta `narrator_id`. `name_norm` is a **generated** column (`normalize_arabic(name)`). Grades stored **twice**: `rank_*_raw` (display) and `rank_ibn_hajar` / `rank_dhahabi` (FKs into `rank_levels`, for math). `is_placeholder` flags mubham `[راو موضع إبهام]` rows |
| `isnad_links` | **Weak entity**, PK `(hadith_id, sanad_no, position)`. One row per narrator position in a chain, propagation order (position 1 = Companion/source … last = compiler). `narrator_id` NULL = unresolved. `resolution` ∈ `A`/`B`/`X`. `transmission_word` and `is_compiler` per link |
| `isnad_edges` | **VIEW**, not a table — teacher→student edges derived by self-joining `isnad_links` on `position = position+1`. Storing edges *and* paths would invite drift (see below) |
| `hadith_mentions` | Surface mentions from `names`; kept for search + resolution audit |
| `hadith_subjects` | Subject tags per hadith |
| `hadith_translations` | Optional English (LK) text where numbering aligns |

### `app` (OLTP — all runtime writes)

- Identity: `users` with IS-A specialization → `students` / `teachers` /
  `admins` via **table inheritance** (child tables enforce the disjoint role).
- Study structure: `circles`, `enrollments`, `study_sets`, `set_items`,
  `assignments`, `assignment_targets`, `progress`.
- Activity: `review_sessions`, `review_items`, `notes`.
- Derived / audit: `student_stats` (trigger-maintained), `audit_log` (shadow
  table for teacher overrides).

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
rows (`ON CONFLICT DO NOTHING`), then `COMMIT`s — or `ROLLBACK`s on error. It is
a **procedure, not a function, precisely because it owns its transaction**
(Postgres functions cannot `COMMIT`).

### `corpus.normalize_arabic(text)`

Strips harakat/tatweel and unifies alef / ta-marbuta / ya variants. Used by the
generated `name_norm` column, the matn index, and ETL resolution.

## Triggers (on `app` writes only)

| Trigger | Fires on | Effect |
|---|---|---|
| `trg_progress_stats` | `app.progress` writes | Recompute-and-store derived counts into `student_stats` |
| `trg_progress_audit` | mastery changes | Append to `audit_log` shadow table; actor read from `current_setting('ilham.user_id')` |

The corpus never fires a trigger.

## Analytics queries (in the DDL as Q1–Q5)

1. **Top Narrators** — hadith count per narrator (placeholder + compiler excluded).
2. **Contested Narrators** — where Ibn Hajar and al-Dhahabi ordinals disagree,
   ordered by disagreement magnitude.
3. **Shared narrators** between two hadiths' chains.
4. **Circle overview** — teacher dashboard; spans `app` + student rows, mastered
   vs assigned with a percentage.
5. **Weakest chains** among studied hadiths — `chain_strength()` over
   `app.set_items` joined to `corpus`.

## Design invariants (intentional and graded — do not "fix")

- **Isnad paths are stored explicitly; edges are derived.** Positions are
  first-class rows, so chain traversal is **aggregation, not recursion** — a
  `WITH RECURSIVE` rewrite would be artificial (PRD req 8). `isnad_edges` is a
  view, not a stored table; a `teacher_narrator_id` self-FK could not model the
  M:N-per-chain reality.
- **`assign_study_set` stays a procedure** (it owns `COMMIT`/`ROLLBACK`). This is
  the deliberate req-5-vs-req-6 distinction.
- **Rijal grades: raw strings for display, ordinals for math.** Keep both
  columns and the three-way distinction: graded / named-but-ungraded / unnamed.
- **Triggers fire on `app` writes only.**
- **Each feature appears once, where it belongs** — no redundant routines, no
  runtime corpus writes, no fake recursion. Restraint is graded (req 8); read
  PRD §5 before adding any routine.
