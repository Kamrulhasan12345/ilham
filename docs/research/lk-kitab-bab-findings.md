# LK kitab and bab findings

Status: research only. No DDL change. No ETL change.
Related issue: #18 (Muqaddimah gap, bug, deferred).

## 0. Ifta: the corpus itself

Ifta is the primary source. Everything else (LK, online) is a witness
against it, never the other way round.

Records and identity:

- Bukhari: 7,410 records, IDs 4-11,555. Muslim: 7,666 records, IDs
  11,558-20,610. IDs stay unique within and across books (two IDs
  missing between the ranges, three before Bukhari's start: source
  gaps, carried as-is).
- The loader keeps 7,275 + 7,626 and drops 135 + 40 numberless records
  as front matter (see below).

Numbering (the two books work differently):

- Bukhari: 7,233 distinct numbers for 7,275 kept records. Mostly
  one-to-one; 39 numbers repeat (max 4 repeats, e.g. 1390, 99). No
  ranges. Compatible with online numbering at 94.6%.
- Muslim: 3,011 distinct numbers for 7,626 records; 1,933 numbers
  repeat, up to 35 narrations under one number (e.g. 1211). Grouped
  numbering: one number, many narrations. No ranges. Online base
  numbers cover 97.6% of them.

Text structure:

- Matn/sanad split exists almost everywhere in Bukhari (91 missing of
  7,275) but is absent in a fifth of Muslim (1,542 of 7,626). Matn-tier
  matching and matn features only fire where the split exists.
- Single-sanad: 6,447 of 7,275 Bukhari (89%), 4,201 of 7,626 Muslim
  (55%). Muslim runs up to 7+ parallel chains (2,048 doubles, 781
  triples). Transmission-word alignment covers single-sanad only, so it
  reaches far less of Muslim.
- 48 Bukhari records carry no chain, no mentions, no narrators (chainless
  texts). Muslim has 1.

Chapter shapes (our 5,158 chapters, by title form):

| Book | Topic babs | Verse-quote | Transmitter-named | Kitab headers | Other/surah | Bare `باب` |
|---|---|---|---|---|---|---|
| Bukhari (3,812) | 3,476 (6,640 h.) | 312 (595 h.) | 46 | 3 (7 h.) | 20 incl. `سورة X` | 1 (10 h.) |
| Muslim (1,346) | 1,319 (7,343 h.) | 8 (32 h.) | 0 | 19 (251 h.) | 0 | 0 |

Muslim files 251 hadiths (3.3%) directly under kitab headers instead
of babs. Bukhari names 46 babs after transmitters (`حدثنا عبدان`)
and quotes verses as 312+ titles. Exactly one chapter is titled bare
`باب` (10 hadiths): shared-title grouping can only bite there.

Front matter (dropped, 175 records):

- Bukhari 135: compiler preface (basmala + `قال الشيخ الإمام`),
  kitab-opening headers (`بسم الله … كتاب الإيمان`), verse headers.
- Muslim 40: narrator-criticism and methodology chapters (33) plus 4
  `مقدمة` records. The Muqaddimah hole is 40 records wide, not 4:
  LK Chapter 0 (92 rows) spans the whole intro, and all of it is
  unmatched. See #18.

## 1. LK taxonomy

LK ships 16 columns on three levels.

- Kitab level: `Chapter_Number`, `Chapter_English`, `Chapter_Arabic`.
- Bab level: `Section_Number`, `Section_English`, `Section_Arabic`.
- Hadith level: `Hadith_number`, `English_Hadith`, `English_Isnad`,
  `English_Matn`, `Arabic_Hadith`, `Arabic_Isnad`, `Arabic_Matn`,
  `Arabic_Comment`, `English_Grade`, `Arabic_Grade`.

Counts from the raw files:

| Book | Rows | Kitabs | Babs | EN isnad | EN matn | EN grade |
|---|---|---|---|---|---|---|
| Bukhari | 7,345 | 97 (1-97) | 3,423 | 7,343 | 7,345 | 7,345 |
| Muslim | 7,314 | 57 (0-56) | 1,335 | 7,292 | 7,313 | 7,314 |

Chapter names in English exist. Section names in English exist. Grades
in both languages exist. The pipeline keeps almost none of this (see §6).

## 2. LK numbering rules

- Bab identity is the pair `(Chapter_Number, Section_Number)`.
- Section numbers restart in each kitab. 166 section numbers repeat
  across Bukhari kitabs, 112 across Muslim kitabs.
- Section numbers run dense 1..N with small gaps.
- Three kitabs have no sections. Their rows attach to the kitab
  directly: Bukhari 65 Tafseer (498 rows), Muslim 0.0 Introduction
  (92 rows), Muslim 51 Hypocrites (21 rows).

## 3. Ifta shape

Each Ifta record carries `book` (collection name only), `chapter`
(a bab title string, no number), and `hadith_num` (hadith numbering
only). Ifta has no kitab field and no bab numbers.

Consequences:

- `corpus.chapters.seq` is loader-assigned (order of first appearance).
  It is stable for one source file, but it is not source data.
- Our 5,158 chapters (3,812 Bukhari + 1,346 Muslim) are babs, not kitabs.
- Muslim Muqaddimah records carry an empty `hadith_num`. The extractor
  drops them as front matter. LK Chapter 0 has no counterpart. See #18.

## 4. Bab overlap (Ifta babs vs LK sections)

Method: all 5,158 Ifta bab titles and all 4,723 LK section keys go
through the database function `corpus.normalize_arabic` on both sides,
then join on the result. No Python approximation.

Results (exact normalized full-title join):

- Bukhari: 142 of 3,812 match (3.7%).
- Muslim: 165 of 1,346 match (12.3%).
- Every match is strictly one-to-one. No key fans out.
- No degenerate keys exist. No normalized title is empty. All Ifta
  normalized titles stay unique.

Near and formatting tiers (R2, same strict one-to-one rule):

- The editions differ in formatting junk (direction marks, quote
  braces, spacing) that normalization keeps. A letters-only comparison
  (the same rule as `staging.match_key`) promotes 1,907 further pairs
  to verified grade: 1,427 Bukhari + 480 Muslim.
- Prefix/extension tiers (first 60/40 letters, then true substring,
  length-guarded) add 408 near matches: 26 + 270 + 76 Muslim,
  3 + 33 Bukhari, plus 3 Bukhari prefix rows. Samples read as the same
  bab with extra clauses on the LK side.
- Totals: about 2,214 verified-grade + 408 near = 2,622 of 5,158 babs
  mappable (51%) by title. Bukhari 1,605 of 3,812 (42%), Muslim 1,017
  of 1,346 (76%). Reverse: 2,057 of 4,679 LK section keys have no Ifta
  counterpart (44%).

Fuzzy distances (R4, token-set ratio on letters-only keys, unmatched
remainder only):

- Score 95+: 1,292 Bukhari + 251 Muslim. Every pair is mutual-best,
  zero collisions either way, strict edit ratio >= 90 on all of them.
  Punctuation and junk variants of the same bab. Verified grade.
- Score 85-95, greedy one-to-one: 137 + 29 kept. Samples read as the
  same bab with inflection or wording variants. Near grade.
- Score 75-85: mixed, with visible false pairs. Junk-prone. Excluded.
- Below 75: junk. Excluded.

Content co-location (R5, through stage-14 translation matches: each of
our chapters votes with its translated hadiths into LK sections):

- 5,002 of 5,158 chapters (97%) sit 100% in one LK section.
- 8 more sit >= 80% in one section. 67 split across sections
  (concentrated in shared-title buckets such as bare `باب`, plus a few
  real multi-topic babs). Kitab level agrees even more: 5,046 of 5,158
  (97.8%) in one LK kitab, 31 split.
- Title matching missed most of this for systematic reasons: LK files
  verse babs under section-less Tafseer (Bukhari 65, 498 rows),
  transmitter-named babs under topic sections, and renames such as
  Ifta `كتاب اللعان` into LK (19, 1) with 27 of 27 hadiths.
- 81 chapters hold zero translated hadiths and cannot vote. 11 of them
  hold 4-46 hadiths each, all titled `كتاب X` (Muslim only): kitab
  header records with real narrations (e.g. #979 Zakat, #2956 Zuhd).
  LK holds none of these rows (phrase search over all 7,314 Muslim
  rows: zero hits), so no text match was ever possible. sunnah.com
  confirms: hadith 979a-h sits before the first numbered bab of Book
  12, filed at kitab level exactly like our records. Real content, LK
  coverage gap, untranslatable from this source.

Verification (the matches are real):

- 273 of 307 matched pairs hold exactly the same hadith count on both
  sides. 29 are close. 5 diverge for known reasons (one bare-`باب`
  title bucket groups several of our chapters; the rest split
  narrations differently between editions, e.g. 11 vs 5).
- Samples read correctly in Arabic with sensible English.
- One deep check (Bukhari 25.1, #1513 both sides) shows the known
  offset: our record is the kitab-opening preamble, LK holds the
  narration. Bab mapping gives co-location, never hadith-level joins.
  Hadith joins stay text-anchored in stage 14.

Rejected hypotheses:

- Strip the `باب` prefix changes nothing (still 142/165).
- Muslim LK sections already carry the prefix (99.9%) yet reach only
  12%. The gap is genuine wording difference between editions, not a
  normalization trick. No automatic full mapping exists.

## 5. Kitab reconciliation with online numbers
| | Online | LK | Our corpus |
|---|---|---|---|
| Bukhari books | 97 (sunnah.com; Bk 1 Revelation 1-7 … Bk 97 Tawheed 7371-7563) | 97 files, ch. 1-97 | No kitab level |
| Muslim books | 57 = 56 books + Introduction (sunnah.com) | 57 files, ch. 0-56 | No kitab level |
| Bukhari babs | ~3,450 (QuranCentral) | 3,423 sections | 3,812 babs |
| Muslim babs | Same order of magnitude | 1,335 sections | 1,346 babs |

LK chapters equal online books exactly, including endpoints
(Revelation … Tawheed; Introduction … ch. 56). Our chapters equal
online sub-chapters in magnitude. Nothing is missing. The two systems
never shared a level or a numbering.

Per-item check (R1, TaqwaPath book lists, 97 + 56 rows):

- Bukhari: 97 of 97 numbers align, 97 of 97 English titles identical,
  97 of 97 Arabic titles identical after normalization.
- Muslim: 56 of 56 align on all three. LK row 0.0 (Introduction) is
  the only LK-only entry; the online list carries the same content
  unnumbered (`/muslim/introduction`).
- Zero title differences. Zero missing kitabs. LK kitab reference data
  is fully corroborated and safe to import verbatim.

The "one-hadith chapters" need no fix: 62.6% of Bukhari babs hold
exactly one hadith in the source (max 60); Muslim holds 13.3%
(max 48). The dump agrees (zero title conflicts, zero chapter-less
hadiths).

## 6. What the database holds

The pipeline keeps five LK columns into staging and publishes one
table: `corpus.hadith_translations` (14,197 rows, 95.28% coverage,
tiers E/P/6/4/M). The only other English in the corpus:
`collections.title_en` (2 manifest rows) and `narrators.name_en`.

The corpus holds no chapter English, no section English, no grades,
no comments, and no split isnad/matn English. `corpus.chapters` has
no English column at all.

## 7. Frontend chapter bug (fixed)

The chapter detail page fetched `/chapters?limit=100` and found the
chapter client-side. The backend caps limits at 100. Any chapter past
seq 100 showed "No such chapter". Fix (branch `fix/chapter-seq-filter`,
uncommitted): optional `seq` filter on `GET /chapters`, detail page
asks for its own seq. Backend suite 165/165, frontend collections
tests 13/13.

## 8. Proposed shape (not approved, not built)

- `corpus.lk_kitabs`: 154 LK kitabs (`collection_id`, `kitab_num`
  as text, `title_en`, `title_ar`). Total table.
- `corpus.lk_sections`: ~4,723 LK babs (kitab, `section_num`,
  `title_en`, `title_ar`). Section-less kitabs have no rows.
- `corpus.chapter_lk_match`: sparse bridge from our chapters to LK.
  Title evidence covers about 2,214 verified-grade + 574 near rows;
  content co-location (hadith majority vote, R5) covers 5,002 chapters
  at 100% plus 8 at >= 80%. The table needs one tier code per
  evidence class. Split chapters (67) and dark chapters (81) get no
  row.
- ETL carries the six `Chapter_*`/`Section_*` columns through staging
  (staging drops after load, so no runtime surface grows).
- Per-hadith LK grades stay out until separately approved.

## 9. Hadith alignment and the merge test (N1/N2)

N1a (numbers): online references use Ifta-compatible systems. Muslim
base numbers cover 97.6% of Ifta numbers (suffixes a/b/c aside).
Bukhari direct overlap is 94.6% plus range refs (`1258, 1259`, the same
convention as LK ranges). LK Muslim runs a separate sequential
1..7314 system and never joins by number.

N1b (text, stage-14 tiers E/P/6/4, online Arabic vs our text): 14,231
of 14,901 matched (95.5% both books; E 12,418, P 1,462, 6 253, 4 98;
fan-out 24). On text-matched pairs, online↔Ifta numbers agree 95.5%
both books. 97.75-99.6% of online-matched hadiths also carry LK
translations: near-total triple coverage.

N2 (merge test, both directions, via text links): online babs hold a
mean 1.10/1.01 Ifta babs (merged 1.6%/1.0%); LK sections 1.12/1.02
(merged 1.5%/1.4%). Reverse means are 1.01-1.02 everywhere. The only
real merges are Tafseer verse granularity: section-less LK kitab 65
absorbs 371 Ifta verse babs, and online Book 65 verse babs group
12-71 Ifta verse babs each. No topical comprising exists. Bab-count
differences come from edition wording and splits at the margins, not
from merges.

## 10. Online bab arbitration (R7)

Scraped all 154 sunnah.com book pages (97 Bukhari + 56 Muslim +
Introduction): 5,413 bab headings with English, Arabic, and in-book
number. Canonical key space (letters-only, `باب`-stripped, one key per
title) for all three sources:

| Book | LK | Ifta | Online | All three |
|---|---|---|---|---|
| Bukhari | 3,343 | 3,812 | 3,950 | 2,809 |
| Muslim | 1,331 | 1,346 | 1,338 | 1,086 |

Where online stands when LK and Ifta disagree (Bukhari): with LK 496
times, with Ifta 219 times, alone 426 times. Muslim: online is LK
(only 8 online-only and 1 LK-only keys). Ifta-only keys (771 Bukhari,
258 Muslim) are transmitter-named babs, verse-quote babs, and
edition splits. Online bab numbering restarts per book and repeats
within books, like LK sections: numbers never join across sources.

Dark-chapter arbitration (the 81 zero-translation chapters): 32 titles
exist online as babs (English recoverable in principle, rights
unchecked), 12 are Muslim kitab headers filed at kitab level online
too (confirmed live: hadith 979a-h sits before the first numbered bab
of Book 12), the rest are transmitter-named and verse babs no online
edition carries as headings.

Caution: online English is the Khan/Siddiqui translation under its own
terms; LK is an LREC research corpus. Borrowing wording needs a rights
check, not just a technical join.

## 12. Extra-bab audit (Ifta-only titles)

1,029 Ifta titles sit in neither LK nor online key sets (771 Bukhari,
258 Muslim). Content accounting per chapter (translated = in LK,
text-matched = in online):

| Bucket | Bukhari | Muslim |
|---|---|---|
| Content in both (all hadiths) | 679 | 192 |
| Partial (most hadiths in both) | 31 | 54 |
| In LK, not online | 37 | 4 |
| In online, not LK | 4 | 8 |
| In neither | 20 | 0 |

85% are pure renames/refiles: real hadiths, present in both others
under different labels. Transmitter-named babs (`حدثنا عبدان`) live
in LK but not online; Muslim kitab headers live online (unbabbled)
but not in LK. 20 Bukhari chapters (all single hadiths, e.g. #6967,
#61) sit in neither: real narrations with full isnads, LK gaps and
online misses. Corpus-wide, 58 hadiths have no bridge at all, and 57
of them have no translated matn-sibling either: true orphans, all
kept in Arabic.

## 13. Open questions

- Table names: `lk_*` prefix vs neutral names.
- Muqaddimah treatment in the import (see #18).
- Near tier in v1 or verified-only first (recommendation: verified
  first, near behind a tier flag).
- English for the 32 online-present dark chapters: rights check first.
