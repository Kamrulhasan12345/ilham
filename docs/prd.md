# Ilham (إلهام) — Final PRD

**A hadith study platform: read-only scholarly corpus + teacher-led study layer**
**Course:** DBMS term project · **Team:** 2 members
**Stack:** PERN — PostgreSQL, Express, React, Node
**Status:** FINAL — all dataset, stack, and design decisions settled
**Companion artifact:** `db/schema.sql` (complete DDL: schemas, routines, triggers, queries)

---

## 0. Summary

Ilham is a teacher-led hadith study platform built on a fixed, richly-structured
corpus of canonical hadith collections. Each hadith carries its text (matn), its
chain of narrators (isnad) in propagation order, per-link transmission words, and
links to narrator profiles bearing classical rijal gradings (Ibn Hajar,
al-Dhahabi). The corpus is reference data — loaded once through a
staging-JSONB ELT pipeline, then made read-only by database permissions. On top
sits the study layer: students join teacher-run circles (halaqa), organize
hadiths into study sets, complete assignments, and log review sessions; teachers
assign and oversee; a researcher view exposes the narrator network analytically.
Architecture: a warehouse-like analytical corpus (OLAP-flavored, read-only) and a
classic OLTP study layer, separated by schema design inside one PostgreSQL
instance — not by separate systems.

---

## 1. Goals and non-goals

### Goals
- Correctly-normalized schema spanning a read-only corpus and a read-write user
  layer, with the corpus read-only **by permissions**, not convention.
- Real analytical depth from the corpus's natural structure: isnad chains,
  narrator networks, divergent rijal gradings, transmission-word semantics.
- Real transactional depth from the user layer: explicit COMMIT/ROLLBACK, a
  multi-table PL/pgSQL procedure, triggers for derived stats and audit logging,
  a computed chain-strength function — each used only where genuinely
  appropriate (req 8), including *not* using recursion where positions are
  stored explicitly.
- Clean two-person ownership split; both members defend every line (req 9).

### Non-goals
- No user-generated corpus content — nobody adds or grades hadiths.
- No new authenticity rulings — the platform displays classical gradings and a
  transparently-derived chain metric; it issues no religious judgments.
- No audio / recitation detection — teachers judge; the system records.
- No third-party auth, no warehouse/lake infrastructure, no scaling concerns
  beyond one instance.

---

## 2. Datasets (verified) and ETL

### 2.1 Sources and roles

| Source | Verified contents | Role |
|---|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle; from sunnah.alifta.gov.sa — King Abdullah bin Abdul Aziz Program for the Prophetic Sunnah; Univ. of Malta 2025 curation) | 276,347 hadiths, 33 books, ~863 MB JSON + manifest + 20,957 narrator profiles. Coverage: text/chapter/num 100%, chains 98.9%, narrator names 98.6%, mention→ID links 94.1%, matn split 87.8–94.1%. Profiles: rank_by_ibn_hajar 41.5%, rank_by_al_dhahabi 25.7%, tabaqa 41.6%. Fully Arabic. | **PRIMARY corpus** — text + chains + narrator IDs + rijal ranks, internally linked in one authoritative source |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0; Data in Brief 54:110439) | Sahih Muslim: 7,748 hadiths, 14,155 sanads, 2,092 narrators, ~77.8K edge rows. Chains from IHSAN Network; narrator IDs from muslimscholars.info (fuzzy+manual matched, expert-validated). Ordered chains reconstructable via intractionLabel; propagation direction; Arabic + English name columns. | **VALIDATION set** (ordered-chain agreement on the Muslim subset; disagreements framed as cross-check between two extractions) + **English narrator names** for exactly the Muslim-chain narrators. Cuttable. |
| **LK-Hadith-Corpus** (Leeds/King Saud, LREC 2020) | ~34K hadiths, six books, English+Arabic with segmented isnad/matn; grade fields messy (42/296 distinct values); only Bukhari manually verified | **ENGLISH enrichment** where numbering aligns; optional |

### 2.2 Verified structure (from sample inspection — spike #1 ANSWERED)

- `chain_of_narrators` = list of sanads; each sanad = **disambiguated canonical
  name strings** (text "سفيان" → chain "سفيان بن عيينة") in **propagation order**
  (Companion first, compiler last). Same direction as MIS.
- `names` = per-hadith `[surface_plain, surface_diac, narrator_id]` triples in
  text order; compiler absent (he is the author, not a mention).
- `narration_words` aligns 1:1 with chain links → stored as
  `transmission_word` (direct hearing vs ʿanʿana feeds chain_strength).
- Placeholder profiles exist (`[راو موضع إبهام]`, all fields NULL) →
  `is_placeholder` flag; excluded from Top Narrators; treated as
  chain-weakening. Three-way rijal distinction: **graded / named-but-ungraded /
  unnamed** — mirrors real methodology.
- ~1% of records are front-matter (empty hadith_num, empty arrays) → filtered.
- `hadith_text` carries a "N - " prefix → stripped in ETL.

### 2.3 Narrator resolution (two paths, cross-checked)

- **Path A (any sanad count):** normalized canonical chain name → profile
  `name`/`display_name` via `normalize_arabic()` (strip harakat/tatweel, unify
  alef/ta-marbuta/ya variants).
- **Path B (single-sanad hadiths):** reverse chain (minus compiler) zips
  positionally onto `names` → exact narrator_ids, no string matching.
- Where both resolve → cross-check; disagreements logged. Unresolved rows keep
  `raw_name`, `resolution = 'X'` — honest degradation, never dropped.

### 2.4 ELT pipeline (the report's lake→warehouse story)

Raw JSON files on disk (mini **data lake**, schema-on-read) → Node streams book
arrays into `staging.raw_*` JSONB tables → **all shaping in SQL**
(`jsonb_array_elements WITH ORDINALITY` explodes chains; front-matter filter is
a WHERE clause) → typed corpus tables (**warehouse-like**, loaded once) →
`REVOKE` writes from app role + `DROP SCHEMA staging` → app layer is the
**OLTP** side. If asked "why not a real warehouse": single-source, small-scale,
dual-workload on one instance — separation by schema design, not by systems.

### 2.5 Scope controls

- Load the six canonical books (or Bukhari + Muslim first); manifest-driven
  loader generalizes to all 33 — stated, not built.
- Streaming parse only (~863 MB vs 6 GB RAM); PostgreSQL is light on the
  dev laptop; staging dropped after load.
- Remaining spikes: **#2** rank coverage among top-500 narrators by chain
  frequency (weights chain_strength); **#3** MIS↔Ifta numbering alignment via
  normalized matn comparison on ~20 samples (validation join method).

---

## 3. Personas and access

| Role | Core needs |
|---|---|
| **Student** | Browse corpus, build study sets, complete assignments, log reviews, notes |
| **Teacher** | Run circles, enroll students, assign sets, review/override progress |
| **Researcher/Admin** | Narrator analytics, contested rankings, chain strength; admin |

Visibility enforced in the query layer: students see only their own study data;
teachers see their circles; students never see each other; corpus readable by
all authenticated users. Language: Arabic canonical throughout; English via LK
(hadith text, where aligned) and MIS (`name_en` for Muslim-chain narrators);
graceful Arabic fallback.

---

## 4. Features

### Corpus (read-only)
1. Collection → chapter → hadith browsing; search (normalized Arabic).
2. Hadith detail: matn, full isnad per sanad with transmission words, narrator
   links, chain-strength indicator.
3. Narrator profiles: biography, rijal ranks (raw strings displayed; normalized
   for computation), chains they appear in, English name where available.
4. Analytics pages: Top Narrators · Contested Narrators (Ibn Hajar vs
   al-Dhahabi) · Shared narrators between chains · Weakest chains.

### Study layer (read-write)
5. In-house auth (JWT/session), three roles, guard on every route (reqs 1–2).
6. Circles: create, enroll, oversee (teacher dashboard = circle overview query).
7. Study sets and set items.
8. Assignments: `assign_study_set` procedure fans out to enrolled students and
   initializes progress rows — one atomic operation (reqs 3+6).
9. Review sessions: session + per-hadith results + progress updates in one
   explicit transaction at the API layer (req 3); stats trigger fires (req 4a).
10. Teacher overrides with audit trail via trigger to shadow table (req 4b).
11. Personal notes.

### Out of scope (cut first if slipping)
Spaced-repetition scheduling; LK English enrichment; MIS validation.

---

## 5. Requirement mapping (the graded core)

| Req | Mechanism | Notes |
|---|---|---|
| 1–2 | In-house JWT/session auth + per-route guard, 3 roles | Teammate-owned |
| 3 | Explicit BEGIN/COMMIT/ROLLBACK: review-session flow (API layer, node-postgres) and inside the procedure | Checklist's exact multi-table example |
| 4 | `trg_progress_stats` (derived counts — recompute-and-store) + `trg_progress_audit` (mastery changes → `audit_log` shadow table; actor via `set_config('ilham.user_id',…)`) | Fire on user writes only; corpus never |
| 5 | `chain_strength(hadith_id)` — weakest-link per sanad, best sanad wins; graded→rank weight (stricter of two scholars), ungraded→0.50, unnamed/unresolved→0.15; ʿanʿana −0.05; compiler excluded | **Aggregation, not recursion** — positions are stored explicitly, so WITH RECURSIVE would be artificial (req 8) |
| 6 | `assign_study_set` — PL/pgSQL **PROCEDURE** because it owns COMMIT/ROLLBACK (functions can't) — the req-5-vs-6 line in Postgres terms | Fan-out + progress init |
| 7 | Q1 Top Narrators · Q2 Contested Narrators · Q3 Shared narrators · Q4 Circle overview · Q5 Weakest chains (function + joins) | Five written in the DDL; three required |
| 8 | Each feature once, where it belongs; no corpus writes at runtime ever; no fake recursion; no redundant routines | Restraint is graded |
| 9 | Simple explainable routines; `normalize_arabic` and weights documented; each member authors their half | |

---

## 6. Backend flows

```
Corpus seed (one-time, not a feature):
  raw JSON → staging JSONB → SQL transforms → corpus tables
  → resolution passes A/B → rank_map curation → REVOKE + DROP staging

POST /assignments (teacher, owns circle):
  CALL app.assign_study_set(circle, set, due)   -- procedure owns its txn

POST /review-sessions (student or teacher):
  BEGIN → insert session → insert review_items → update progress
        → [trg_progress_stats fires] → COMMIT / ROLLBACK

PATCH /progress (teacher override):
  set_config('ilham.user_id', …) → BEGIN → update → [trg_progress_audit] → COMMIT

GET /analytics/* , /narrators/:id , /hadiths/:id :
  pure reads over corpus (+ chain_strength function); no transactions
```

---

## 7. Ownership

- **Teammate:** auth + guards (1–2); circles/enrollment; `assign_study_set`
  (6); circle-overview query; stats trigger (4a); sets `ilham.user_id` in
  middleware for the audit trigger.
- **You:** ETL + resolution passes; corpus schema; `normalize_arabic`;
  `chain_strength` (5); corpus analytics queries (7); review-session
  transaction (3); audit trigger (4b); rank_map curation.
- **Seam:** the review/progress flow — his API transaction fires your triggers.

---

## 8. Milestones (10 weeks)

| Wk | Deliverable | Gate |
|---|---|---|
| 1–2 | Spikes #2–3; run `db/schema.sql`; streaming loader; transforms + resolution; rank_map v1; auth | Corpus browsable; login works |
| 3–4 | Procedure, API transactions, both triggers, chain_strength — tested in psql directly | All routines demonstrable without UI |
| 5–6 | React: corpus browse, sets, circles, assignments | Study loop end-to-end |
| 7–8 | Analytics pages; review/override flow with audit; polish | Demo-ready |
| 9 | Stretch: MIS validation → name_en; LK English; scheduling | Cut in this order |
| 10 | Hardening; seed polish; report (ELT/architecture §2.4, methodology §5); defense prep | Final |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Multi-sanad `narration_words` alignment unclear | Inspect one multi-chain record before writing that branch; single-sanad path already exact |
| Rank coverage too sparse for chain_strength | Spike #2 measures effective (frequency-weighted) coverage; unknown = neutral, never weak |
| Resolution rate lower than expected | Two cross-checking paths; unresolved rows retained with raw_name; rate reported honestly |
| MIS↔Ifta editions misaligned | Spike #3 detects; MIS validation is optional and cuttable |
| Placeholder/compiler polluting analytics | `is_placeholder` + `is_compiler` flags; excluded in Q1/Q3 and chain_strength — designed in |
| Course expects Oracle | Confirm PostgreSQL with instructor before building (checklist is DB-agnostic) |
| Scope creep | Cut order fixed: scheduling → LK English → MIS validation; core covers every requirement without them |
| Req 9 defense | Routines deliberately simple; ownership split ensures authorship |
