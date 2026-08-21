# Ilham (إلهام) — final PRD

**A hadith study platform: a read-only corpus and a study layer that a teacher leads**
**Course:** term project for a database course · **Team:** 2 members
**Stack:** PERN — PostgreSQL, Express, React, Node
**Status:** FINAL. Every dataset, stack, and design decision is settled.
**Companion files:** `db/00_init.sql` … `db/05_post_load.sql` (the complete DDL:
schemas, routines, triggers, queries) and `etl/` (the pipeline that fills them)

This document uses ASD-STE100 Simplified Technical English.

---

## 0. Summary

Ilham is a hadith study platform. A teacher leads the study. The data is a fixed
corpus of canonical hadith collections.

Each hadith carries four things:

- its text, the matn;
- its chain of narrators, the isnad, in transmission order;
- the transmission word for each link;
- links to narrator profiles, which hold the classical rijal grades of Ibn Hajar
  and al-Dhahabi.

The corpus is reference data. The pipeline loads it one time into flat typed
staging tables. The database then makes it read-only with permissions.

The study layer sits on top. Students join circles (halaqa) that a teacher runs.
They collect hadiths into study sets, complete assignments, and record review
sessions. Teachers assign work and check it. A researcher view shows the narrator
network for analysis.

The architecture puts an analytical read-only corpus and an OLTP study layer in
one PostgreSQL instance. Schema design separates them, not different systems.

---

## 1. Goals and non-goals

### Goals

- A correctly normalised schema that covers a read-only corpus and a read-write
  user layer. Permissions make the corpus read-only, not convention.
- Real analytical depth from the natural structure of the corpus: isnad chains,
  narrator networks, rijal grades that disagree, and the meaning of the
  transmission words.
- Real transactional depth from the user layer: explicit COMMIT and ROLLBACK, a
  multi-table PL/pgSQL procedure, triggers for derived stats and for audit, and a
  computed chain-strength function.

  Use each one only where it is genuinely correct (req 8). This includes the
  decision **not** to use recursion where the positions are explicit rows.
- A clean split of ownership between two persons. Both members can defend every
  line (req 9).

### Non-goals

- No corpus content from users. Nobody adds a hadith and nobody grades one.
- No new authenticity rulings. The platform shows classical grades and one clear
  chain metric. It gives no religious judgement.
- No audio and no recitation detection. Teachers judge. The system records.
- No third-party authentication, no warehouse or lake infrastructure, and no
  growth past one instance.

---

## 2. Datasets and the ETL

### 2.1 Sources and roles

| Source | Contents, as checked | Role |
|---|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle, from sunnah.alifta.gov.sa. King Abdullah bin Abdul Aziz Program for the Prophetic Sunnah. University of Malta, 2025) | 276,347 hadiths, 33 books, about 863 MB of JSON, a manifest, and 20,957 narrator profiles. Coverage: text, chapter, and number 100%; chains 98.9%; narrator names 98.6%; mention to identifier 94.1%; matn split 87.8% to 94.1%. Profiles: rank_by_ibn_hajar 41.5%, rank_by_al_dhahabi 25.7%, tabaqa 41.6%. All Arabic | **PRIMARY corpus.** Text, chains, narrator identifiers, and rijal grades. One authoritative source links them all |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0. *Data in Brief* 54:110439) | Sahih Muslim: 7,748 hadiths, 14,155 sanads, 2,092 narrators, about 77,800 edge rows. The chains come from the IHSAN Network. The narrator identifiers come from muslimscholars.info, matched by fuzzy and manual methods and checked by experts. You can rebuild the ordered chains from `intractionLabel`. It has Arabic and English name columns | **VALIDATION set.** It checks ordered-chain agreement on the Muslim subset, and any disagreement is a cross-check between two extractions. It also gives **English narrator names** for the Muslim-chain narrators. You can cut it |
| **LK-Hadith-Corpus** (Leeds and King Saud, LREC 2020) | About 34,000 hadiths in six books. English and Arabic, with the isnad and matn split. The grade fields are unreliable, with 42 of 296 distinct values. Only Bukhari is checked by hand | **ENGLISH text.** The join is on normalised Arabic text. The numbering systems do **not** agree: 99.94% of the matched Muslim pairs carry a different number. Loaded, with 95.3% coverage |

### 2.2 The structure of the source — spike #1, answered

- `chain_of_narrators` is a list of sanads. Each sanad is a list of
  **disambiguated canonical name strings**. The text
  <span dir="rtl">سفيان</span> becomes the chain form
  <span dir="rtl">سفيان بن عيينة</span>. The order is the order of transmission:
  the Companion is first and the compiler is last. MIS uses the same direction.
- `names` holds `[surface_plain, surface_diac, narrator_id]` triples for each
  hadith, in text order. The compiler is absent, because he is the author and not
  a mention.
- `narration_words` holds one entry for each **edge**. Its length is the chain
  length minus one, and it runs in text order, which is the reverse of the chain.
  The word that arrives at position `q` is `narration_words[len − q]`.

  `transmission_word` stores it. Direct hearing against ʿanʿana feeds
  `chain_strength`. The loader aligns the words only for single-sanad hadiths
  whose lengths agree exactly, which is 88.1% of them.
- Placeholder profiles exist, such as <span dir="rtl">[راو موضع إبهام]</span>,
  and all their fields are NULL. The loader sets `is_placeholder`. Top Narrators
  excludes them, and `chain_strength` treats them as a weakness.
- The schema keeps three rijal states apart: **graded**, **named but ungraded**,
  and **unnamed**. This mirrors real methodology.
- About 1% of the records are front matter, with an empty number and empty
  arrays. The loader removes them.
- `hadith_text` carries an `"N - "` prefix. The loader removes it.

### 2.3 Narrator resolution — two paths that check each other

- **Path A**, for any sanad count. It matches the normalised canonical chain name
  against the profile `name` or `display_name`, through `normalize_arabic()`. That
  function removes the diacritic marks and the tatweel, and unifies the alif, ta
  marbuta, and ya forms.
- **Path B**, for single-sanad hadiths. It reverses the chain, removes the
  compiler, and zips it positionally onto `names`. This gives exact narrator
  identifiers with no string compare.
- Where both paths resolve, they check each other. The pipeline records any
  disagreement.
- An unresolved row keeps its `raw_name` and gets `resolution = 'X'`. This is
  honest degradation. The loader never drops a row.

Result: **99.58%** of the non-compiler positions resolved. Over 49,685 positions
that both paths reached, the two agreed on **99.23%**.

### 2.4 The pipeline — the lake-to-warehouse story of the report

Raw files sit on disk as a small **data lake**, and the schema is read on use.
Node streams the book arrays and flattens the structure into **flat typed**
`staging` tables. The loader removes the front matter, removes the prefix, and
aligns the words.

**SQL then does all semantic work**: dimension extraction, resolution,
normalisation, typed loads, grades, and translations. The stages fill the typed
corpus tables, which the pipeline loads one time.

The database then removes write permission from the app role and runs
`DROP SCHEMA staging`. The app layer is the **OLTP** side.

If somebody asks "why not a real warehouse", the answer is short: one source,
small scale, and two workloads on one instance. Schema design separates them, not
different systems.

### 2.5 Scope controls

- Load the six canonical books, or Bukhari and Muslim first. A manifest drives
  the loader, so it extends to all 33. This is stated, not built.
- Stream the files only. About 863 MB against 6 GB of RAM. PostgreSQL is light on
  the development laptop. The load deletes staging at the end.
- One spike remains: **#2**, the rank coverage among the top 500 narrators by
  chain frequency. This weights `chain_strength`.
- Spike **#3** is **settled for LK and Ifta, and loaded**. The numbering systems
  do not agree at all: 99.94% of the matched Muslim pairs carry a different
  number. The join is therefore on normalised Arabic text, anchored at the first
  narration verb, in five tiers that `hadith_translations.match_via` records.
  Coverage is 95.3%. MIS validation should use the same method.

---

## 3. Personas and access

| Role | Main needs |
|---|---|
| **Student** | Browse the corpus, build study sets, complete assignments, record reviews, write notes |
| **Teacher** | Run circles, enrol students, assign sets, check and override progress |
| **Researcher or admin** | Narrator analytics, contested grades, chain strength, and administration |

The query layer enforces visibility. A student sees only their own study data. A
teacher sees their own circles. One student never sees another. Every
authenticated user can read the corpus.

Arabic is canonical throughout. English appears where it exists: the hadith text
in `corpus.hadith_translations`, the narrator names in `narrators.name_en` from
MIS, and the collection titles. Each one is optional for each row, and each one
falls back to Arabic.

---

## 4. Features

### The corpus — read-only

1. Browse from collection to chapter to hadith. Search on normalised Arabic.
2. Hadith detail: the matn, the full isnad for each sanad with its transmission
   words, links to the narrators, and the chain-strength value.
3. Narrator profiles: the biography, the rijal grades (raw strings for display,
   normalised codes for computation), the chains that the narrator appears in, and
   the English name where it exists.
4. Analytics pages: Top Narrators, Contested Narrators (Ibn Hajar against
   al-Dhahabi), Shared narrators between chains, and Weakest chains.

### The study layer — read-write

5. Authentication built in-house, with JWT or a session. Three roles. A guard on
   every route (reqs 1 and 2).
6. Circles: create them, enrol students, and check the work. The teacher
   dashboard is the circle-overview query.
7. Study sets and set items.
8. Assignments. The `assign_study_set` procedure sends the assignment to every
   enrolled student and creates the progress rows. It is one atomic operation
   (reqs 3 and 6).

   A hadith already studied is still owed under a new assignment. The system
   tracks obligations for each (student, hadith, assignment), and a new assignment
   never resets earlier mastery.
9. Review sessions. The session, the result for each hadith, and the progress
   updates run in one explicit transaction at the API layer (req 3). The stats
   trigger then fires (req 4a).
10. Teacher overrides, with an audit trail that a trigger writes to a shadow
    table (req 4b).
11. Personal notes.

### Out of scope — cut in this order if time is short

Spaced-repetition scheduling, then more English text, then MIS validation.

Note that `corpus.hadith_translations` stays in either case. To cut the import
means fewer translated rows, not a missing feature.

---

## 5. Requirement map — the graded core

| Req | Mechanism | Notes |
|---|---|---|
| 1–2 | In-house JWT or session authentication, a guard on each route, three roles | The teammate owns this |
| 3 | Explicit BEGIN, COMMIT, and ROLLBACK. The review-session flow at the API layer, and inside the procedure | The exact multi-table example that the checklist asks for |
| 4 | `trg_progress_stats` recomputes and stores the derived counts. `trg_progress_audit` records mastery changes in the `audit_log` shadow table, and reads the actor from `set_config('ilham.user_id', …)` | They fire on user writes only. The corpus never fires a trigger |
| 5 | `chain_strength(hadith_id)`. The weakest link in each sanad, and the best sanad wins. A graded narrator gives the rank weight, from the stricter of the two scholars. An ungraded narrator gives 0.50. An unnamed or unresolved one gives 0.15. An anʿana link takes 0.05. The compiler is excluded | **Aggregation, not recursion.** The positions are explicit rows, so `WITH RECURSIVE` would be artificial (req 8) |
| 6 | `assign_study_set` is a PL/pgSQL **PROCEDURE**, because it owns its COMMIT and ROLLBACK. A function cannot. This is the difference between requirement 5 and requirement 6 in PostgreSQL terms | The fan-out and the progress rows |
| 7 | Q1 Top Narrators · Q2 Contested Narrators · Q3 Shared narrators · Q4 Circle overview · Q5 Weakest chains, with the function and joins · Q6 Assignment completion | Six are written in the DDL. Three are required |
| 8 | Each feature appears one time, where it belongs. There is never a corpus write at runtime, no artificial recursion, and no duplicate routine | Restraint is graded |
| 9 | Routines are simple and explainable. `normalize_arabic` and the weights are documented. Each member writes their own half | |

---

## 6. Backend flows

```
Corpus load (one time, not a feature):
  raw files → staging flat typed tables → SQL transforms → corpus tables
  → resolution pass A and pass B → apply staging.rank_map
  → attach the English text → REVOKE + DROP staging

POST /assignments (a teacher who owns the circle):
  CALL app.assign_study_set(circle, set, due)   -- the procedure owns its transaction

POST /review-sessions (a student or a teacher):
  BEGIN → insert session → insert review_items → update progress
        → [trg_progress_stats fires] → COMMIT or ROLLBACK

PATCH /progress (a teacher override):
  set_config('ilham.user_id', …) → BEGIN → update → [trg_progress_audit] → COMMIT

GET /analytics/* , /narrators/:id , /hadiths/:id :
  reads over the corpus, and the chain_strength function. No transactions
```

---

## 7. Ownership

- **The teammate:** authentication and guards (1 and 2); circles and enrolment;
  `assign_study_set` (6); the circle-overview query; the stats trigger (4a). The
  teammate also sets `ilham.user_id` in the middleware for the audit trigger.
- **You:** the ETL and the resolution passes; the corpus schema;
  `normalize_arabic`; `chain_strength` (5); the corpus analytics queries (7); the
  review-session transaction (3); the audit trigger (4b); and the curation of
  `staging.rank_map`.
- **The seam:** the review and progress flow. The API transaction of the teammate
  fires your triggers.

---

## 8. Milestones — 10 weeks

| Week | Deliverable | Gate |
|---|---|---|
| 1–2 | Spike #2. Run `db/run_ddl.sh`. The streaming loader, the transforms, and resolution. `staging.rank_map` v1. Authentication | You can browse the corpus. Login works |
| 3–4 | The procedure, the API transactions, both triggers, and `chain_strength`. Test them in psql directly | Every routine works without a user interface |
| 5–6 | React: browse the corpus, make sets, run circles, give assignments | The study loop works from end to end |
| 7–8 | The analytics pages. The review and override flow with the audit. Polish | Ready to demonstrate |
| 9 | Stretch goals: MIS validation for `name_en`, then more English text, then scheduling | Cut in this order |
| 10 | Hardening. Polish the seed. Write the report (§2.4 and §5). Prepare the defence | Final |

---

## 9. Risks

| Risk | What we do about it |
|---|---|
| The alignment of `narration_words` is unclear for several sanads | The loader aligns single-sanad hadiths only, where the lengths agree exactly. It leaves the others NULL. A wrong sigha changes `chain_strength` with no sign of an error |
| The rank coverage is too thin for `chain_strength` | Spike #2 measures the coverage weighted by frequency. An unknown grade is neutral and never weak. Four passes now cover 98.57% of the chain positions |
| The resolution rate is lower than we expect | Two paths cross-check each other. An unresolved row keeps its `raw_name`. We report the rate honestly |
| The MIS and Ifta editions do not align | The text-match method of stage 14 is proven and settled. MIS validation stays optional |
| Placeholders and compilers pollute the analytics | The flags `is_placeholder` and `is_compiler` exist. Q1, Q3, and `chain_strength` exclude them. This is designed in |
| The course expects Oracle | Confirm PostgreSQL with the instructor before you build. The checklist does not name a database |
| The scope grows | The cut order is fixed: scheduling, then English text, then MIS validation. The core covers every requirement without them |
| The defence of requirement 9 | The routines are deliberately simple. The ownership split makes the authorship clear |
