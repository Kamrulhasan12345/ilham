# Data sources & ETL

How the read-only corpus is sourced, loaded once, and locked down. This is the
report's "lake → warehouse" story. Full requirement detail lives in
[`prd.md`](prd.md) §2; the resulting tables are in [`database.md`](database.md).

## Sources

| Source | Contents (verified) | Role |
|---|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle; from sunnah.alifta.gov.sa — King Abdullah bin Abdul Aziz Program for the Prophetic Sunnah; Univ. of Malta 2025 curation) | 276,347 hadiths, 33 books, ~863 MB JSON + manifest, 20,957 narrator profiles. Text/chapter/num ~100%, chains 98.9%, narrator names 98.6%, mention→ID 94.1%. Fully Arabic | **Primary corpus** — text, chains, narrator IDs, rijal ranks, internally linked in one authoritative source |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0; *Data in Brief* 54:110439) | Sahih Muslim: 7,748 hadiths, 14,155 sanads, 2,092 narrators, ordered chains with Arabic + English name columns | **Validation** (ordered-chain agreement on the Muslim subset) + **English narrator names** for the Muslim-chain narrators. Cuttable |
| **LK-Hadith-Corpus** (Leeds/King Saud, LREC 2020) | ~34K hadiths, six books, English+Arabic with segmented isnad/matn; grade fields messy | **English enrichment** where numbering aligns; optional |

Language: Arabic is canonical throughout. English appears only where MIS
(`name_en`) or LK (hadith text) align, with graceful Arabic fallback.

## Verified source structure

- `chain_of_narrators` = list of sanads; each sanad = **disambiguated canonical
  name strings** in **propagation order** (Companion first, compiler last) — same
  direction as MIS.
- `names` = per-hadith `[surface_plain, surface_diac, narrator_id]` triples in
  text order; the compiler is absent (he is the author, not a mention).
- `narration_words` aligns 1:1 with chain links → stored as `transmission_word`
  (direct hearing vs ʿanʿana feeds `chain_strength`).
- Placeholder profiles (`[راو موضع إبهام]`, all fields NULL) → `is_placeholder`;
  excluded from analytics, treated as chain-weakening.
- ~1% front-matter records (empty `hadith_num`, empty arrays) → filtered out.
- `hadith_text` carries an `"N - "` prefix → stripped in ETL.

## The ELT pipeline

```
raw JSON files on disk            (mini data lake — schema-on-read)
        │  Node streams book arrays (streaming parse: ~863 MB vs laptop RAM)
        ▼
staging.raw_* JSONB tables        (structural flattening only)
        │  ALL semantic shaping in SQL:
        │  jsonb_array_elements WITH ORDINALITY explodes chains;
        │  front-matter filter is a WHERE clause
        ▼
typed corpus tables               (warehouse-like — loaded once)
        │  narrator resolution passes A / B (below)
        │  rank_map curation (raw rijal strings → ordinals)
        ▼
REVOKE writes on corpus.* + DROP SCHEMA staging
        ▼
corpus is read-only in permission AND in practice; app layer is the OLTP side
```

**Division of labor:** Node does structural flattening (nesting → rows,
front-matter filter, prefix strip, word alignment). SQL does all semantic
shaping: dimension extraction, resolution, normalization, typed loads.

## Narrator resolution (two cross-checked paths)

- **Path A** (any sanad count): normalized canonical chain name → profile
  `name_norm`, via `normalize_arabic()`. Marks `resolution = 'A'`.
- **Path B** (single-sanad hadiths only): the reversed chain (minus compiler)
  zips positionally onto the text-order `names` mentions → exact `narrator_id`
  with no string matching. Marks `resolution = 'B'`.
- Where both resolve, they **cross-check**; disagreements are logged (Path A
  kept). Unresolved links keep `raw_name` and `resolution = 'X'` — honest
  degradation, never dropped.

## Scope controls

- Load the six canonical books first (or Bukhari + Muslim); the manifest-driven
  loader generalizes to all 33.
- Streaming parse only; staging dropped after load.
- Cut order if slipping (fixed): spaced-repetition scheduling → LK English
  enrichment → MIS validation. The core requirements hold without them.
