# LK kitab and bab import plan

Status: plan only. No DDL. No ETL change. No branch yet.
Findings: `lk-kitab-bab-findings.md` (same directory).
Related issue: #18 (Muqaddimah gap, bug, deferred).

## 1. Goal

Give every chapter in the corpus an English-capable home: 154 kitabs
with verified English names, ~4,723 LK sections as reference, and one
bridge row per resolvable chapter. Chapters without proof keep Arabic.
Hadith-level English does not change.

## 2. Numbers that constrain the plan

| Fact | Value |
|---|---|
| Corpus chapters (Ifta babs) | 5,158 (3,812 Bukhari + 1,346 Muslim) |
| Corpus hadiths | 14,901 |
| Hadiths with LK English | 14,197 (95.3%) |
| Hadiths with online match | 14,231 (95.5%) |
| Hadiths with neither bridge | 58 (57 true orphans) |
| LK kitabs | 154, all verified against online lists |
| LK sections | ~4,723 (3 kitabs section-less) |
| Chapters voting 100% one LK section | 5,002 |
| Chapters voting >= 80% | 8 |
| Chapters split across sections | 67 (36 agree on kitab) |
| Chapters dark (zero translated hadiths) | 81 (12 kitab headers, 32 online-present, rest Ifta-only) |
| Title-exact bab links | 307 |
| Formatting/fuzzy bab links | ~3,450 |
| Near bab links | ~574 |
| Muqaddimah records | 40 dropped + 92 LK rows orphaned (see #18) |

## 3. New schema

Three tables in `corpus`. Runtime-read-only like the rest of the
corpus. The ETL fills them once; `05_post_load.sql` already revokes
`corpus.*` schema-wide, so no new grant work (verify at build time).

`corpus.lk_kitabs`: one row per LK kitab. 154 rows, total table.
`(collection_id, kitab_num text, title_en, title_ar)`.
`kitab_num` is text: LK mixes `5` and `5.0`. Muslim `0.0`
Introduction loads as reference with zero matches (see #18).

`corpus.lk_sections`: one row per LK section. ~4,723 rows.
`(collection_id, kitab_num, section_num text, title_en, title_ar)`.
Section-less kitabs (Bukhari 65, Muslim 0, Muslim 51) have no rows;
their letters attach at kitab level.

`corpus.chapter_lk_match`: sparse bridge, one row per chapter at most.
`(chapter_id PK, kitab_num NOT NULL, section_num NULL, title_tier
char(1) NULL, vote_pct numeric NULL, vote_n int NULL)`.
Splits get no row, except a kitab-only row (`section_num NULL`) where
the kitab vote is unanimous (36 today). Dark chapters get no row,
except kitab headers, which map structurally to their kitab with
`section_num NULL` and `title_tier NULL`.

## 4. Tier codes

Hadith translations keep the existing `match_via`: E/P/6/4/M
(stage 14, unchanged).

Chapter bridge `title_tier` codes:

- `T`: title exact. Full normalized title equal, strict one-to-one.
  307 rows.
- `F`: formatting or fuzzy. Letters-only equal, or token-set >= 95
  with mutual-best pairing and strict edit ratio >= 90. ~3,450 rows.
- `N`: near. 60/40-char prefix extension or true substring or
  85-95 fuzzy, length-guarded, strict one-to-one. ~574 rows. The UI
  hides `N` by default.
- NULL: no title link. The row rests on the vote alone, or on
  structure (kitab headers).

`vote_pct`/`vote_n` record the content vote beside the tier: share of
the chapter's translated hadiths sitting in the mapped section, and
the translated count. A row with `title_tier NULL` and `vote_pct =
100` is a rename (e.g. `كتاب اللعان` into LK (19, 1), 27 of 27).
Below 80% the ETL writes no row.

## 5. Method: section home for each hadith

For each hadith with an LK translation, the ETL knows its LK row
(`t_match.lk_row_id`), and the LK row carries its section after §7.
Home = that (kitab, section). No text work. No number work.

For each hadith with an online match but no LK translation, home =
its online bab, chained to the LK section through the online↔LK
section key match (3,305 Bukhari + 1,329 Muslim keys). Tier of that
leg is recorded as online evidence, not LK evidence.

For each hadith with neither bridge (58 today): no home. Arabic only.

## 6. Method: kitab and section for each chapter

For each chapter, count member hadiths per LK section (§5 homes):

- One section holds 100% of translated hadiths: map there
  (`vote_pct = 100`). 5,002 chapters.
- One section holds >= 80%: map there. 8 chapters.
- Otherwise: no section row. If one kitab holds 100%: kitab-only row
  (36 split chapters today).
- Zero translated hadiths: no row, except kitab headers, which map to
  their kitab structurally (12 today).

Title tiers (§4) attach independently on the same row and license the
English *name*. Placement comes from the vote; naming comes from the
title. A vote-only row still places the chapter for browsing.

Never group by shared title. Bare `باب` and any repeated title map
per `chapter_id` through votes only. Title rules may only propose,
never place.

## 7. ETL changes

1. `extract.js`: `LK_COLS` gains six columns
   (`chapter_num/en/ar`, `section_num/en/ar`). Structural flattening
   only, same as today.
2. `staging.lk_hadiths` gains the six columns. Staging drops after
   load, so no runtime surface grows.
3. New stage file between 14 and 19 (e.g. `15_kitab_babs.sql`):
   truncate-fill `lk_kitabs` and `lk_sections` from distinct LK keys;
   run the title tiers in temp tables on the stage-14 recipe
   (letters-only key = `staging.match_key`, strict one-to-one,
   length guards); run the content vote from `t_match` (still
   visible: LK section per row); publish `chapter_lk_match`;
   snapshot metrics.
4. `05_post_load.sql`: unchanged apart from verifying the schema-wide
   revoke covers the three tables.
5. Grades stay out (constant column, zero information). Muqaddimah
   stays out (see #18). Online English stays out (rights unchecked).

## 8. Read contract

- Chapter list and detail return `title_en` + tier where a bridge row
  exists, else Arabic. `N` rows stay hidden unless the caller asks.
- Chapter → kitab path always resolves (kitab rows are total).
- Hadith detail is unchanged.
- New endpoint or filter surfaces kitabs; chapters gain an optional
  kitab filter (same pattern as the `seq` filter fix).

## 9. Acceptance checks

- `lk_kitabs` holds 154 rows; per-book counts 97/57.
- `lk_sections` holds ~4,723 rows; section-less kitabs hold none.
- Unanimous-vote chapters >= 5,000; split chapters carry no section
  row; dark chapters carry none except structural kitab rows.
- Spot triangulation from the findings still passes (e.g. Taif 13/13
  in (64, 56); Lian 27/27 in (19, 1)).
- Backend suite and frontend suite stay green.

## 10. Deliverables riding along

DDL change drags the graded set: ERD `.dot` + SVGs, `database.md`,
`data-and-etl.md`, PRD requirement map. Branch first. No commits
without request.
