# Kitab and bab findings

Status: research only. This document changes no DDL and no ETL.
Related issue: #18 (Muqaddimah gap).
Scripts: `scripts/` (same directory). §1 gives the run order.

## 0. Goal

The UI must be English-friendly, and its structure must be accurate. The
popular hadith sites show each book as kitabs (97 for Bukhari, 56 plus
the Introduction for Muslim). Each kitab holds babs, and each bab holds
hadiths. The corpus does not have this structure. It has 5,158 Ifta
chapters with Arabic titles only, and no kitab level.

The target structure is:

```
collection → kitab → (surah, Bukhari Tafseer only) → bab → hadith
```

This structure also makes study sets easier to build. A teacher can
select one hadith, some babs, or a whole kitab. `app.set_items` is
hadith-level, so the selection expands to hadiths. Study sets need no
schema change.

This research answers one question: can each corpus hadith go into the
correct kitab and bab, with evidence?

The answer is yes. The methods place 14,897 of 14,901 hadiths (99.97%)
automatically. A manual check of 11 hadiths places the last 4 and corrects
2. §6 gives the details. The 40 Muqaddimah records join the corpus after
this research (§8), which gives 14,941 hadiths.

## 1. Sources and method

| Source | What it is | Bukhari + Muslim |
|---|---|---|
| Ifta | The corpus (`db/ilham.dump`) | 7,275 + 7,626 hadiths at research time (7,666 with the Muqaddimah) |
| LK | LREC research corpus, 16 CSV columns | 7,345 + 7,314 rows |
| Dump | `etl/raw/HadithTable.sql.gz`, sunnah.com MariaDB dump | 7,277 + 7,459 rows |
| Site | 154 sunnah.com book pages, scraped 2026-09-25 | 7,277 + 7,459 hadiths |

Script run order:

1. `parse_sn.py` parses the dump to CSV.
2. `fm.mjs` extracts the 175 records that the ETL drops.
3. `setup.sql` loads the dump, LK, and the dropped records into a
   scratch schema `research`.
4. `match.sql` runs the stage-14 tiers (E/P/6/4/M) against LK and
   against the dump.
5. `scrape.py` reads the 154 book pages at 1 request each second.
6. `fuzzy.py` scores the candidates with seven metrics (§4).
7. `analyze.py` calibrates each metric.
8. `combine.py` combines all evidence into one placement for each
   hadith.
9. `gen_placement.py` writes `etl/hadith_placement.sql`, with the
   manual decisions of §6.

Controls:

- The LK replica of stage 14 gives 14,197 matches. Each match has the
  same hadith and the same tier as `corpus.hadith_translations`.
- Each site hadith carries the id `h<arabicURN>`. All 14,736 site
  hadiths join the dump on `arabicURN`, and they all have the same kitab.

The scratch schema is not part of the database. Drop it after use.

## 2. The target structure (the site)

| | Bukhari | Muslim |
|---|---|---|
| Kitabs | 97 | 57 (Introduction + 56) |
| Bab headings | 3,979 | 1,343 |
| Surah-level babs (see below) | 10 | 0 |
| Babs with no hadith | 114 | 4 |
| Bab headings without English | 23 | 2 |
| Hadiths before the first bab of a kitab | 6 | 177 |
| Bab intro paragraphs (`echapintro`) | 592 | 4 |
| Surah level | Kitab 65 only, 83 surahs | None |

Facts about the structure:

- Bab numbers restart in each kitab. In kitab 65, they restart in each
  surah. The key of a bab is its position on the page, not its number.
- Muslim puts 177 hadiths directly under a kitab, before the first bab
  (for example, hadith 979 in Zakat). The corpus must permit a hadith
  in a kitab without a bab.
- In kitab 65, 10 surahs hold hadiths directly under the surah heading,
  before any bab. Each such run gets a bab of its own, titled with the
  surah and with no bab number. Every Tafseer hadith is then in a bab.
- The page order is the order of the scraped JSON. An early version of
  the scripts numbered the rows after the load, and one row moved. The
  scripts now key each row on its JSON index.
- The dump has only the babs that hold hadiths. It has no surah names,
  no intro paragraphs, and no heading-only babs. The site has all of
  them.
- The dump groups hadiths into babs almost exactly as the site does.
  5 Bukhari dump babs split on the site, and 2 site babs merge dump
  babs. The Muslim grouping is identical.

## 3. How the witnesses relate

- The LK kitab and the site kitab are the same for all 14,076 hadiths
  that match both. All 154 LK kitab titles are equal to the site
  titles.
- LK section numbers are the site bab numbers. 4,578 of 4,823 LK
  section titles are equal to the site's English bab title.
- LK English and the site English are the same translation. 12,642 of
  14,076 hadith texts have a trigram similarity above 0.8.
- Result: LK is a derivative of sunnah.com. LK is coarser in one place:
  kitab 65 (Tafseer) has no sections in LK.

## 4. Matching methods and their calibration

The research tried each method that the earlier online study used,
except semantic matching (see the end of this section).

Text methods compare the Ifta Arabic with each witness row. The
comparison key is `corpus.normalize_arabic`, then letters and spaces
only, then the anchor at the first narration verb, then the first 400
characters. Char 3–5-gram TF-IDF picks the 25 best candidates. Every
metric then scores each candidate.

| Code | Metric |
|---|---|
| `tfidf` | Cosine of char 3–5-gram TF-IDF |
| `lev` | `rapidfuzz` ratio (Indel-normalized Levenshtein) |
| `levd` | True Levenshtein, normalized |
| `part` | Partial ratio (best substring alignment) |
| `tset` | Token-set ratio |
| `tsort` | Token-sort ratio |
| `jw` | Jaro-Winkler |

Calibration: the script runs each metric on the hadiths whose witness
row is known from stage 14. It then counts how often the best
candidate is in the correct bab. Bab accuracy at the top score band:

| Metric | Band | Dump, Bukhari | Dump, Muslim | LK, Bukhari | LK, Muslim |
|---|---|---|---|---|---|
| `part` | >= 98 | 100.0% | 99.9% | 100.0% | 99.9% |
| `tset` | >= 98 | 99.8% | 99.8% | 99.8% | 99.8% |
| `lev` | >= 98 | 100.0% | 100.0% | 99.9% | 100.0% |
| `levd` | >= 95 | 99.3% | 100.0% | 98.0% | 100.0% |
| `tsort` | >= 95 | 98.9% | 98.7% | 98.8% | 98.7% |
| `tfidf` | >= 95 | 99.2% | 98.6% | 99.4% | 99.3% |
| `jw` | >= 95 | 99.7% | 98.2% | 99.5% | 98.1% |

Accuracy falls fast below these bands. Example: `jw` at 85–90 gives
34–68%. `analyze.py` prints the full tables.

A fuzzy placement needs two strong metrics that agree, and no strong
metric that disagrees.

Structural methods do not read text:

- **Sandwich.** The placed hadiths before and after, in source order,
  are in the same bab. Leave-one-out accuracy: 6,648 of 6,651 (99.95%).
- **Inheritance.** All other placed hadiths of the same Ifta chapter
  are in one bab. Leave-one-out accuracy: Bukhari 98.4%, Muslim 99.93%.
- **Number.** All dump rows with the Ifta hadith number are in one bab.
  On text-matched pairs, the Ifta number equals the dump base number
  for 99.7% of Bukhari and 98.4% of Muslim.
- **Title.** The Ifta chapter title equals or contains the site bab
  title, or the reverse.

Agreement between methods, where both apply (bab level):

| | Dump text | Dump fuzzy | LK text | LK fuzzy | Sandwich |
|---|---|---|---|---|---|
| Dump fuzzy | 99.92% | | | | |
| LK text | 100.00% | 99.92% | | | |
| LK fuzzy | 99.90% | 99.90% | 99.94% | | |
| Sandwich | 99.94% | 99.77% | 99.97% | 99.79% | |
| Inheritance | 99.28% | 99.12% | 99.54% | 99.43% | 100.00% |

Semantic matching was not run. The machine has about 430 MB of free
memory, and a multilingual embedding model needs about 500 MB. After
the other methods, only 11 hadiths are open (§6). All 11 are short
isnad fragments (`( ح ) وحدثنا …`) with no matn. Semantic similarity
cannot place a fragment that has no content. A manual check is faster
and exact.

## 5. Decision rule

Each method votes for a `(kitab, bab)` with a weight:

| Evidence | Weight |
|---|---|
| Text tier E / P / 6 / M / 4 | 3 / 2.5 / 2 / 1.5 / 1 |
| Dump fuzzy | 2 |
| LK fuzzy | 1.5 |
| Number | 2 |
| Sandwich | 1.5 |
| Title | 1.5 |
| Inheritance | 1 |

The target with the highest total wins. A margin below 1.5 goes to
manual review.

The vote corrects errors in the text tiers. Example: Muslim 1736
(prohibition of betrayal) matched a row in the Book of Faith through a
40-letter prefix that holds only the isnad. Five other methods put it
in kitab 32. The vote changes 51 placements. A sample of 16 changes and
9 hand-checked cases were all correct.

## 6. Placement result

| | Bukhari | Muslim |
|---|---|---|
| In a bab | 7,269 | 7,448 |
| At kitab level (the site does the same) | 6 | 178 |
| Not placed by the methods (placed by hand) | 0 | 4 |
| Margin below 1.5 | 2 | 5 |

The table shows the final state, after the manual check.

The manual list has 11 hadiths: the 4 not placed and the 7 with a low
margin. Hand review of these 11:

- 7 have a clear bab from the title and the neighbours.
- 2 low-margin picks are wrong. Muslim 1935 belongs in kitab 34, and
  Muslim 1977 belongs in kitab 35. A shared isnad pulled the fuzzy
  votes to the wrong kitab.
- The 4 not placed are isnad fragments of Muslim 1365 (kitab 16) and
  Muslim 157 (kitab 47). Each one belongs to the bab of its main
  narration.

Site babs:

- Bukhari: 3,870 of 3,989 babs get at least one corpus hadith. 5 babs
  hold only hadiths that the corpus does not have. 114 are heading-only.
- Muslim: 1,337 of 1,343 babs get at least one corpus hadith. 2 hold
  only site hadiths. 4 are heading-only.

Ifta chapters against site babs:

- 5,077 Ifta chapters go into one site bab.
- 66 Ifta chapters split across site babs. 30 of them cross a kitab
  boundary.
- 15 Ifta chapters hold only kitab-level hadiths.
- 22 site babs merge more than one Ifta chapter.

The Ifta chapter is therefore not a reliable unit of structure. The
hadith placement is.

## 7. Stage-14 errors found

The vote shows that stage 14 attaches the wrong English to some
hadiths. The kitab of the LK row differs from the voted kitab in these
cases:

| Tier | Checked | Wrong kitab |
|---|---|---|
| E | 12,026 | 1 |
| P | 1,684 | 1 |
| 6 | 278 | 1 |
| 4 | 106 | 4 |
| M | 103 | 0 |

Examples: Bukhari 1443 (charity) has the English of a hadith about
looking into a house. Muslim 544 (the steps of the minbar) has the
English of the confessing adulterer.

Tier 4 matches on 40 letters. Often these letters are only the isnad.
About 4% of tier-4 translations are in the wrong kitab. The bab-level
check finds a few more (tier 4: 3 of 92, tier M: 3 of 63). This is a
separate bug in stage 14. The fix is to require the vote to agree
before a translation is published.

**Fixed (issue #24).** Stage 14 now matches only inside one kitab: the
LK `Chapter_Number` must equal the placement `kitab_num`. The rebuild
removed 6 wrong translations, changed 2, and added 60. Coverage moved
from 95.2% to 95.5%.

## 8. Records that the ETL drops

Bukhari (135 records without a number):

- 127 match a site bab intro paragraph. 65 match a heading-only bab.
- 8 contain a narration that is in a site hadith. 4 match nothing.
- These records are structure (bab headings, verse glosses, the
  preface), not hadiths. They can fill the Arabic intro text of a bab.

Muslim (40 records, the Muqaddimah). Issue #18, now fixed.

Before the fix:

- Ifta kept 24 Muqaddimah hadiths (numbers 1–7). All sources put them in
  the Introduction.
- The extractor dropped 40 Muqaddimah records, because they have no number.
- 28 of the 40 are reports about narrators. They match site hadiths
  "Introduction 26" to "Introduction 77" and LK kitab 0. One Ifta record
  often holds several site hadiths (up to 16).
- 12 of the 40 are Imam Muslim's own prose: the preface and the
  methodology sections.

The fix:

- `etl/book_manifest.json` gives Sahih Muslim the key
  `unnumbered_label: "Muqaddimah"`. The extractor keeps Muslim's numberless
  records and numbers them `Muqaddimah 1` to `Muqaddimah 40` in source
  order. Bukhari has no such key, so its 135 numberless records stay out.
- Each Ifta chapter title of the 40 records names exactly one bab of the
  Introduction on the site. `etl/hadith_placement.sql` files them there
  (via `M`, with the reason on each row). The 4 preface records go to the
  kitab level, before the first bab.

The result:

| Place in the Introduction | Hadiths | With English | With a chain |
|---|---|---|---|
| Before the first bab (preface) | 4 | 0 | 0 |
| Bab 1 | 2 | 0 | 2 |
| Bab 2 | 5 | 5 | 5 |
| Bab 3 | 8 | 8 | 8 |
| Bab 4 | 11 | 11 | 11 |
| Bab 5 | 7 | 7 | 7 |
| Bab 6 | 22 | 17 | 8 |
| Bab 7 | 1 | 0 | 0 |
| Bab 8 | 4 | 0 | 0 |

- The Introduction holds 64 hadiths. Stage 14 attaches LK English to 24 of
  the 40 new records, with no change to its tiers.
- LK's Introduction holds only its 92 narrations, and the site shows the
  preface outside its hadith list. The 12 prose passages therefore have no
  English source. They keep their Arabic, as the corpus rule says.
- 23 of the new records carry no chain (the prose, and statements such as
  «قال مسلم»). `chain_strength` returns NULL for them, like the other
  chainless hadiths (72 in total).

## 9. Ifta facts that constrain the design

- Bukhari: 7,233 distinct numbers for 7,275 hadiths. Muslim: 3,011
  distinct numbers for 7,626 hadiths (one number groups up to 35
  narrations). The site suffix (`1211 a`, `1211 b`) tells the
  narrations apart.
- 2,388 Bukhari chapters (62.6%) and 179 Muslim chapters (13.3%) hold
  one hadith.
- `corpus.chapters.seq` is set by the loader. It is not source data.
- The dump grade and the LK grade have one value each (`Sahih`). They
  give no information.
- The dump has sunnah.com narrator ids on 14,471 rows. This is a second
  witness for stage 12. It is out of scope here.

## 10. Rights

- The sunnah.com repositories have no license file. The developers page
  offers an API key and offline dumps on request. It states no terms of
  reuse.
- LK carries the same English as sunnah.com (§3). The corpus already
  publishes this English through `hadith_translations`. A new
  structure from the same source does not change the rights position.
- A placement table (hadith → kitab number, bab position) holds facts
  only, no text.
- Do not commit the dump or the scrape. `etl/raw/` is git-ignored.

## 11. Decisions for the build

1. **Source of the structure.** Take the site structure (kitabs, surahs,
   all babs, English titles) from the dump and the scrape, or take it
   from LK alone. LK has no Tafseer babs and no heading-only babs.
2. **How the ETL places hadiths.** Commit a curated placement file
   (like `etl/rank_map.sql`), made by these scripts. Or run the
   matching in SQL during the ETL. `part` and `tset` have no SQL
   version, so SQL would lose the two best metrics.
3. **The Ifta chapter.** Replace `corpus.chapters` with the new babs,
   or keep it as provenance beside them.
4. **Stage-14 fix.** Correct the translation errors of §7 in the same
   change, or in a separate change.

Decided on 2026-09-25: (1) the dump and the scrape, (2) a curated
placement file, (3) replace `corpus.chapters`, (4) a separate change,
issue #24. The Muqaddimah (#18) is fixed in the same change as the
hierarchy (§8).
