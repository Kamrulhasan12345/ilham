# Data sources & ETL

How the read-only corpus is sourced, loaded once, and locked down. This is the
report's "lake → warehouse" story. Full requirement detail lives in
[`prd.md`](prd.md) §2; the resulting tables are in [`database.md`](database.md).

## Sources

| Source | Contents (verified) | Role |
|---|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle; from sunnah.alifta.gov.sa — King Abdullah bin Abdul Aziz Program for the Prophetic Sunnah; Univ. of Malta 2025 curation) | 276,347 hadiths, 33 books, ~863 MB JSON + manifest, 20,957 narrator profiles. Text/chapter/num ~100%, chains 98.9%, narrator names 98.6%, mention→ID 94.1%. Fully Arabic | **Primary corpus** — text, chains, narrator IDs, rijal ranks, internally linked in one authoritative source |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0; *Data in Brief* 54:110439) | Sahih Muslim: 7,748 hadiths, 14,155 sanads, 2,092 narrators, ordered chains with Arabic + English name columns | **Validation** (ordered-chain agreement on the Muslim subset) + **English narrator names** for the Muslim-chain narrators. Cuttable |
| **LK-Hadith-Corpus** (Leeds/King Saud, LREC 2020) | ~34K hadiths, six books, English+Arabic with segmented isnad/matn; grade fields messy | **English enrichment** where numbering aligns; optional bulk feeder for `corpus.hadith_translations` — cutting it costs coverage, not the feature |

Language: Arabic is canonical throughout. English is modelled in three places:
**hadith text** (`corpus.hadith_translations`, source-tagged), **narrator names**
(`narrators.name_en`, from MIS) and **collection titles** (`collections.title_en`,
manual). Every one is optional per row — a missing translation falls back to
Arabic rather than blanking the page.

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
staging flat typed tables         (structural flattening only:
        │                          hadiths, chain_rows, mentions,
        │                          narrators, rank_map)
        │  ALL semantic shaping in SQL: dimension extraction,
        │  resolution, normalization, typed loads
        ▼
typed corpus tables               (warehouse-like — loaded once)
        │  narrator resolution passes A / B (below)
        │  apply staging.rank_map (raw rijal strings → rank_code)
        ▼
REVOKE writes on corpus.* + DROP SCHEMA staging
        ▼
corpus is read-only in permission AND in practice; app layer is the OLTP side
```

**Division of labor:** Node does structural flattening (nesting → rows,
front-matter filter, prefix strip, word alignment). SQL does all semantic
shaping: dimension extraction, resolution, normalization, typed loads.

Staging lands as **flat typed tables, not JSONB** — Node has already exploded
the nesting by the time SQL sees it, so no JSON operators appear in the
transforms. `staging.hadiths.raw_doc` keeps the original JSON string purely as
an inert debug window (shape evidence for alignment disputes); no transform ever
reads it.

## Narrator resolution (two cross-checked paths)

- **Path A** (any sanad count): normalized canonical chain name → profile
  `name_norm`, via `normalize_arabic()`. Marks `resolution = 'A'`.
- **Path B** (single-sanad hadiths only): the reversed chain (minus compiler)
  zips positionally onto the text-order `names` mentions → exact `narrator_id`
  with no string matching. Marks `resolution = 'B'`.
- Where both resolve, they **cross-check**; disagreements are logged (Path A
  kept). Unresolved links keep `raw_name` and `resolution = 'X'` — honest
  degradation, never dropped.

Path B reads `staging.mentions` directly; mentions are never loaded into
`corpus`, since resolution is their only consumer and it runs while staging is
still present. One Node pass emits all the staging tables together — never
regenerate one without the others, or Path B's positional zip silently
misaligns.

## Rank normalization

`staging.rank_map` is curated during ETL (`normalize_arabic`'d raw rijal string
→ `rank_code`) and applied once:

```sql
UPDATE corpus.narrators n SET rank_ibn_hajar = rm.rank_code
FROM staging.rank_map rm
WHERE rm.raw_string = corpus.normalize_arabic(n.rank_ibn_hajar_raw);
-- same for rank_dhahabi
```

The map lives in `staging`, not `corpus`: narrators reference
`corpus.rank_levels` **directly**, so nothing reads the map at runtime and it
drops with the schema. Unmapped raw strings are reported before the drop; an
unmapped grade leaves the code NULL, which `chain_strength` treats as ungraded
(`0.50`), not as weak.

## Scope controls

- Load the six canonical books first (or Bukhari + Muslim); the manifest-driven
  loader generalizes to all 33.
- Streaming parse only; staging dropped after load.
- Cut order if slipping (fixed): spaced-repetition scheduling → LK English
  enrichment → MIS validation. The core requirements hold without them.
