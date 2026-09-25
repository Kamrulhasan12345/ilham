# Kitab and bab import plan

Status: superseded, kept as a record. The build took a different design:
the full site structure (kitabs, surahs, babs) replaces `corpus.chapters`,
and each hadith has its own placement. Decisions (findings §11): structure
from the sunnah.com dump and scrape, a curated placement file, replace the
chapters, fix stage 14 separately. Branch: `feat/kitab-bab-hierarchy`.
Findings: `lk-kitab-bab-findings.md` (same directory).
Related issue: #18 (Muqaddimah gap).

## 1. Goal

Give each chapter a kitab and, where the evidence permits, an English
name. The plan loads 154 kitabs, 4,804 LK sections, and one bridge row
for each chapter that the evidence places. A chapter without proof
keeps its Arabic title. Hadith English does not change.

Version 1 uses LK only. sunnah.com is a better bab witness (findings
§7), but its terms are not confirmed (findings §12). The schema takes a
`source` column, so a second witness needs no DDL change later.

## 2. Numbers that constrain the plan

| Fact | Value |
|---|---|
| Corpus chapters (Ifta babs) | 5,158 (3,812 Bukhari + 1,346 Muslim) |
| Corpus hadiths | 14,901 |
| Hadiths with LK English | 14,197 (95.3%) |
| LK kitabs | 154 (97 + 57) |
| LK sections | 4,804 (3,473 + 1,331) |
| Section-less LK kitabs | 3 (Bukhari 65, Muslim 0, Muslim 51) |
| Chapters with a 100% LK vote | 5,002 |
| Chapters with an 80–99% LK vote | 8 |
| Split chapters | 67 (41 inside one kitab) |
| Chapters with no LK vote | 81 |
| LK title evidence (equal / contains / trigram) | 3,787 / 617 / 107 |

## 3. Decisions in this plan

The review of the earlier draft found three blockers. This plan decides
each one as follows. Change a decision here before the build, if needed.

1. **Vote input.** `t_match` is a temporary table (`ON COMMIT DROP`),
   and each stage has its own transaction. A new stage cannot read it.
   Decision: stage 14 writes `staging.lk_match (hadith_id, lk_row_id)`
   from `t_match` before it commits. Stage 15 reads that table. Staging
   drops after the load, so no runtime surface grows.
2. **Title tiers in SQL only.** The token-set ratio tier goes. The new
   tiers use `strpos` and `pg_trgm.similarity`. `pg_trgm` is already
   installed.
3. **No online leg.** Version 1 has no sunnah.com and no scraped data.
   The 208 hadiths that only sunnah.com matches get no home in version 1.

## 4. New schema

Three tables in `corpus`. They are read-only at runtime, like the rest
of the corpus. `05_post_load.sql` revokes writes on `corpus.*` for the
whole schema. Check at build time that the revoke covers the new tables.

`corpus.kitabs`: one row for each kitab. 154 rows. A total table.

```
collection_id smallint  REFERENCES corpus.collections
kitab_num     smallint  -- LK Chapter_Number cast to an integer; 0 = Introduction
title_en      text NOT NULL
title_ar      text NOT NULL
source        text NOT NULL DEFAULT 'LK'
PRIMARY KEY (collection_id, kitab_num)
```

`corpus.sections`: one row for each LK section. 4,804 rows.
A section-less kitab has no rows.

```
collection_id, kitab_num  REFERENCES corpus.kitabs
section_num   smallint
title_en      text NOT NULL
title_ar      text NOT NULL
source        text NOT NULL DEFAULT 'LK'
PRIMARY KEY (collection_id, kitab_num, section_num)
```

`corpus.chapter_placement`: a sparse bridge. One row for each chapter at
most.

```
chapter_id    integer PRIMARY KEY REFERENCES corpus.chapters
collection_id smallint NOT NULL
kitab_num     smallint NOT NULL
section_num   smallint NULL
title_tier    char(1)  NULL      -- see §5
vote_pct      numeric  NULL
vote_n        integer  NULL
source        text NOT NULL DEFAULT 'LK'
FOREIGN KEY (collection_id, kitab_num) REFERENCES corpus.kitabs
FOREIGN KEY (collection_id, kitab_num, section_num) REFERENCES corpus.sections
```

- The composite foreign key to `sections` does not apply when
  `section_num` is NULL (`MATCH SIMPLE`). The foreign key to `kitabs`
  still applies. A kitab-level row is therefore always valid.
- `collection_id` repeats the chapter's collection. A `CHECK` cannot
  read another table, so stage 15 verifies that it equals
  `chapters.collection_id`, and it fails the stage on a mismatch.

## 5. Title tiers

The hadith tiers stay as they are: E/P/6/4/M in `match_via`.

Title key for both sides: `corpus.normalize_arabic`, letters only, then
remove a leading `باب` and the eulogy `صلى الله عليه وسلم`. The tier
compares the chapter with its voted section only. A title never places a
chapter.

| Code | Rule | Rows (LK) |
|---|---|---|
| `T` | Title keys are equal | 3,787 |
| `C` | One title key contains the other | 617 |
| `S` | `pg_trgm.similarity` >= 0.6 | 107 |
| NULL | No title evidence. The vote places the row | 98 + kitab-level rows |

- `T` and `C` permit the English section name.
- `S` does not permit the English name by default. The API returns it
  only when the caller asks for it.
- A section that more than one chapter votes into gets no title tier.
  Those chapters are placed but not named (31 today).

## 6. Placement rules

For each chapter, count its translated hadiths in each LK
`(kitab, section)`. The count uses `staging.lk_match` (§3.1).

1. One section holds 100%: write a section row. 5,002 chapters.
2. One section holds 80–99%: write a section row. 8 chapters.
3. The winning home is a section-less kitab: write a kitab-level row
   (`section_num NULL`). This includes the 366 Tafseer chapters.
4. Otherwise, if one kitab holds 100%: write a kitab-level row.
   41 chapters.
5. Otherwise: no row.
6. No translated hadith: no row. Exception: a Muslim `كتاب X` header
   chapter. LK has no rows for these 12 chapters, so version 1 gives
   them no row. sunnah.com places them later (findings §9).

Never group chapters by a shared title. The bare `باب` title and other
repeated titles map through the vote of each `chapter_id`.

## 7. ETL changes

1. `etl/src/extract.js`: add six columns to `LK_COLS`
   (`kitab_num`, `kitab_en`, `kitab_ar`, `section_num`, `section_en`,
   `section_ar`). Keep the raw strings. Structural work only.
2. `db/03_staging.sql`: add the six columns to `staging.lk_hadiths`.
   Add `staging.lk_match`.
3. `etl/sql/14_translations.sql`: insert `t_match` into
   `staging.lk_match` before `COMMIT`.
4. New `etl/sql/15_kitabs.sql`, in one transaction:
   - Cast `kitab_num` and `section_num` to integers. `nan` becomes NULL.
   - Fill `kitabs` and `sections` from the distinct keys. Where a key
     has two title spellings (35 + 3), take the most frequent spelling.
   - Run the vote (§6) and the title tiers (§5).
   - Write `chapter_placement`, then the metrics.
5. `etl/src/load.js`: add `'15_kitabs'` to the `STAGES` array.
6. `db/05_post_load.sql`: no change. Verify the revoke.
7. Out of scope: LK grades (one constant value), the Muqaddimah (#18),
   and sunnah.com (terms not confirmed).

## 8. Read contract

- Chapter list and chapter detail return `kitab_num`, the kitab title,
  and `title_en` with its tier where a bridge row permits a name.
  Otherwise they return Arabic.
- The API hides tier `S` names unless the caller asks for them.
- A new endpoint lists the kitabs. `GET /chapters` gets an optional
  `kitab` filter, with the same pattern as the `seq` filter.
- Hadith detail does not change.

## 9. Acceptance checks

- `kitabs` holds 154 rows: 97 Bukhari and 57 Muslim.
- `sections` holds 4,804 rows. The three section-less kitabs hold none.
- `chapter_placement` holds at least 5,000 section rows.
- No split chapter has a section row.
- Spot checks: Lian (`كتاب اللعان`) is in (19, 1) with 27 of 27 and tier
  NULL. Taif is in (64, 56) with 13 of 13.
- The backend suite and the frontend suite pass.

## 10. Later: sunnah.com as a second source

Do this only after somebody confirms the terms in writing.

- Load the dump through staging with `source = 'SN'`. No DDL change.
- Expected gain: 26 more chapters placed (including the 12 kitab
  headers), bab homes almost one to one with Ifta babs, and English
  names for about 4,700 chapters with title evidence.
- The same dump can close most of #18 (28 of 40 records) and can check
  narrator resolution. Plan each of these separately.

## 11. Deliverables that must change with the DDL

- The ERD `.dot` files and their SVGs in `docs/erd/`.
- `docs/database.md` and `docs/data-and-etl.md`.
- The requirement map in `docs/prd.md`.

Make a branch first. Do not commit without a request.
