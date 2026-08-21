# Data sources and the ETL

This page shows where the corpus comes from, how the pipeline loads it one time,
and how the database then locks it. This is the "lake to warehouse" part of the
report.

The full requirements are in [`prd.md`](prd.md) §2. The resulting tables are in
[`database.md`](database.md).

## Sources

| Source | Contents (checked) | Role |
|---|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle, from sunnah.alifta.gov.sa. King Abdullah bin Abdul Aziz Program for the Prophetic Sunnah. University of Malta, 2025) | 276,347 hadiths in 33 books. About 863 MB of JSON and a manifest. 20,957 narrator profiles. Text, chapter, and number are near 100%. Chains are 98.9%. Narrator names are 98.6%. Mention to identifier is 94.1%. All Arabic | **Primary corpus.** Text, chains, narrator identifiers, and rijal grades. One source links them all |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0. *Data in Brief* 54:110439) | Sahih Muslim: 7,748 hadiths, 14,155 sanads, 2,092 narrators. Ordered chains with Arabic and English name columns | **Validation** against the Muslim subset, and **English narrator names**. You can cut it |
| **LK-Hadith-Corpus** (Leeds and King Saud, LREC 2020) | About 34,000 hadiths in six books. English and Arabic, with the isnad and matn split. The grade fields are unreliable | **English text** for `corpus.hadith_translations`. The join is on normalised Arabic text, because the two numbering systems do not agree. See below. To cut it costs coverage, not the feature. **95.3% of the corpus has English** |

**Language.** Arabic is canonical everywhere. English appears in three places:
hadith text (`corpus.hadith_translations`, source-tagged), narrator names
(`narrators.name_en`, from MIS), and collection titles (`collections.title_en`,
entered by hand). Each one is optional for each row. A missing translation falls
back to Arabic. It never leaves the page empty.

## The structure of the source, as checked

- `chain_of_narrators` is a list of sanads. Each sanad is a list of **canonical
  name strings**, in **transmission order**. The Companion is first and the
  compiler is last. MIS uses the same direction.
- `names` holds `[surface_plain, surface_diac, narrator_id]` triples for each
  hadith, in text order. The compiler is absent, because he is the author and not
  a mention.
- `narration_words` holds one entry for each **edge**, so its length is the chain
  length minus one. It runs in **text order**, which is the reverse of the chain.
  The word that arrives at position `q` is `narration_words[len − q]`. Position 1
  is the Companion. He receives from nobody, and he correctly gets no word.

  The column `transmission_word` stores it. Direct hearing against ʿanʿana feeds
  `chain_strength`.

  The loader aligns the words **only** for single-sanad hadiths whose lengths
  agree exactly. That is 88.1% of them. With several sanads the array is one flat
  list with no marker for the end of a chain. A wrong alignment would change
  `chain_strength` with no sign of an error, so those stay NULL.
- A placeholder profile uses a bracketed non-name such as
  <span dir="rtl">[راو موضع إبهام]</span>, and all its fields are NULL. The
  loader sets `is_placeholder`. Analytics exclude these rows, and
  `chain_strength` treats them as a weakness.
- About 1% of the records are front matter. They have an empty number and empty
  arrays. The loader removes them.
- The field `hadith_text` carries an `"N - "` prefix. The loader removes it.

## The pipeline

```
raw files on disk                 (the data lake — read the schema on use)
        │  Node streams the book arrays (about 863 MB against laptop memory)
        ▼
staging flat typed tables         (structure only: hadiths, chain_rows,
        │                          mentions, narrators, rank_map, lk_hadiths)
        │  SQL does ALL the meaning: dimensions, resolution,
        │  normalisation, grades, translations
        ▼
typed corpus tables               (loaded one time)
        │  narrator resolution, pass A and pass B (below)
        │  apply staging.rank_map (raw grade strings → rank code)
        │  attach the English text by Arabic text match
        ▼
REVOKE writes on corpus.* + DROP SCHEMA staging
        ▼
The corpus is read-only by permission. The app layer takes every write.
```

**Who does what.** Node does structural work only: it turns nesting into rows,
removes the front matter, removes the number prefix, and aligns the words. SQL
does all semantic work: dimension extraction, resolution, normalisation, typed
loads, grades, and translations.

Staging holds **flat typed tables, not JSONB**. Node has already opened the
nesting before SQL sees the data, so no JSON operator appears in the transforms.

The column `staging.hadiths.raw_doc` keeps the original JSON string as an inert
debug window. It gives evidence about the source shape in a dispute. No transform
reads it. It defaults to off.

## Narrator resolution — two paths that check each other

- **Path A** works for any sanad count. It matches the normalised chain name
  against the profile `name_norm`, through `normalize_arabic()`. It writes
  `resolution = 'A'`.
- **Path B** works for single-sanad hadiths only. It reverses the chain, removes
  the compiler, and zips it onto the `names` mentions in text order. This gives an
  exact `narrator_id` with no string compare. It writes `resolution = 'B'`.
- Where both paths give an answer, they **check each other**. Disagreements go to
  `staging.resolution_conflicts`, and path A wins. Two independent methods that
  agree is the strongest validation in the load. On the real corpus, 49,685
  positions resolved both ways and agreed on **99.23%**.
- Path A fires **only where the normalised name matches exactly one narrator**,
  that is `staging.name_index.n_cand = 1`. Where several narrators match, the link
  gets `resolution = 'C'`. The name is known, but it does not identify a person.

  Without that guard, `UPDATE … FROM` picks one row at random and marks it `'A'`.
  It then assigns the identity of a person by chance.
- An unresolved link keeps its `raw_name` and gets `resolution = 'X'`. This is
  honest degradation. The loader never drops the row.

On Bukhari and Muslim, **99.58%** of the non-compiler positions resolved:
A 116,848, B 440, C 437, X 54.

Path B reads `staging.mentions` directly. Mentions never enter `corpus`, because
resolution is their only consumer and it runs while staging still exists.

One Node pass writes all the staging tables together. **Never regenerate one
without the others.** If you do, the positional zip of path B goes out of
alignment with no sign of an error.

## Grade normalisation

The ETL applies the grades one time, in **four ordered passes**
(`etl/sql/13_ranks.sql`). Each pass fills only what the pass before it left NULL,
so a specific rule beats a general one. The column `narrators.rank_*_via` records
which pass won.

| Pass | Rule | `via` |
|---|---|---|
| 1 | The whole normalised string matches `staging.rank_map` | `E` |
| 2 | The **first word** of the normalised string matches | `T` |
| 3 | The `tabaqa` field says the person is a Companion → `thiqa` | `S` |
| 4 | `staging.narrator_rank_override`, by `narrator_id`. Unconditional | `O` |

Pass 2 gives most of the coverage. The grades are compound verdicts.
<span dir="rtl">ثقة حافظ فقيه , إمام حجة إلا أنه تغير حفظه بأخرة</span> is
`thiqa` plus four clauses of qualification. Whole-string matching treats every
qualification as its own grade. It needs about 1,300 map entries to reach 99% of
Ibn Hajar. Token rules need about 41.

al-Dhahabi also uses few labels. His frequent values are verbs and attributions:
<span dir="rtl">وثق</span>, <span dir="rtl">وثقوه</span>,
<span dir="rtl">وثقه النسائي</span>, <span dir="rtl">ضعفوه</span>. None of them
shares a form with <span dir="rtl">ثقة</span>. You can map them by meaning only.

Passes 3 and 4 exist because **the sources do not grade the eminent**. They write
praise instead, because a grade presupposes a doubt and there is none. 178
narrators hold 16.8% of all chain positions, and they are exactly those giants.
al-Zuhri appears in 3,453 positions and Abu Hurayra in 3,538.

`chain_strength` takes the weakest link. One ungraded al-Zuhri at the neutral
`0.50` therefore caps every chain he appears in. The metric would score the
*strongest* isnads lowest. That is an inversion, not a gap.

The result: **98.57%** of the chain positions carry a code.

The map lives in `staging`, not in `corpus`. Narrators reference
`corpus.rank_levels` **directly**, so nothing reads the map at runtime and it
goes away with the schema. The pipeline reports the unmapped strings before the
deletion.

An unmapped grade leaves the code NULL. `chain_strength` treats NULL as ungraded
(`0.50`), not as weak. **Keep this asymmetry.** To guess *weak* for an unknown
verdict would defame a narrator whom the source praised.

## English translations (LK)

`corpus.hadith_translations` takes its rows from LK-Hadith-Corpus. That source
ships one CSV for each chapter, under `etl/raw/lk-translations/<book>/`. Each row
carries the English text **and the Arabic**. The Arabic is what makes the
attachment possible.

**The two sources share no usable identifier.** LK numbers Sahih Muslim from 1 to
7314, straight through. Ifta uses the traditional grouped numbering, 1 to 3033,
and splits each group into one record for each narration.

The table below uses pairs that match on **text**. A text match proves that the
two records are the same hadith. The question is then how often their numbers
disagree.

| | Pairs matched on text | Numbers disagree |
|---|---:|---:|
| Sahih Muslim | 6,758 | 6,755 (**99.94%**) |
| Sahih al-Bukhari | 6,595 | 2,117 (31.96%) |

A number join does not only miss rows. It attaches the English of one hadith to a
**different** hadith. Both texts read plausibly, so nothing after that point can
find the error.

LK numbers are also not unique. Bukhari repeats 19 of them, and 129 rows hold a
*range* such as `3450-3451-3452`, where LK joined what Ifta splits. They cannot
even be a staging key. `staging.lk_hadiths` therefore uses a surrogate key and
keeps `hadith_num` only as a reported cross-check.

**The join is on normalised Arabic text**, reduced to Arabic letters only. The two
editions punctuate, space, and vocalise differently. Two systematic differences
go first:

- Ifta puts the <span dir="rtl">باب</span> chapter title in front of
  `text_plain` on 4,462 hadiths. It often adds a Qur'anic preamble that is absent
  from `chapters.title_ar`, so you cannot remove it by comparison alone. The
  function `staging.anchor()` cuts both sides at the first narration verb, such
  as <span dir="rtl">حدثنا</span> or <span dir="rtl">أخبرنا</span>. This removes
  the Ifta preamble and leaves LK unchanged. This one step moved the match rate
  from 53% to 90%.
- The tails differ. The same hadith ends differently in the two editions. Hadith
  #2 is 365 letters in Ifta and 279 in LK, and the first 279 are identical. The
  lower tiers therefore compare a prefix, not the whole string.

Five tiers run in order. Each tier sees only what the tier before it left.
`match_via` records the winner:

| Tier | Rule | Bukhari | Muslim |
|---|---|---:|---:|
| `E` | The full anchored text is identical | 5,572 | 6,454 |
| `P` | The first 100 letters, one to one | 1,153 | 531 |
| `6` | The first 60 letters, one to one | 167 | 111 |
| `4` | The first 40 letters, one to one | 59 | 47 |
| `M` | The matn is identical, one to one | 96 | 7 |
| | **Coverage** | **96.87%** | **93.76%** |

Tier `E` lets several hadiths take one LK row. Identical Arabic means that one
English text is correct for all of them. A guard requires every candidate row to
carry the same English.

The prefix tiers forbid this. A shared opening with a different ending is a
different hadith. Those tiers need a strict one-to-one pair on both sides. If they
cannot get one, they leave the hadith unmatched.

**Nothing is removed.** A hadith with no acceptable match keeps its Arabic and
has no translation row. The reader then sees Arabic, which the schema already
intends.

The remainder is a property of LK, not of the corpus. LK ships 7,314 rows for the
7,626 hadiths of Muslim, so at least 312 can never have English from this source.
The pipeline writes the unmatched LK rows and the untranslated hadiths to
`staging.rejects`, so you can audit the coverage figure.

## Scope controls

- Load the six canonical books first, or Bukhari and Muslim. A manifest drives
  the loader, so it extends to all 33.
- Stream the files. Delete staging after the load.
- Cut in this fixed order if time is short: spaced-repetition scheduling, then
  more English text, then MIS validation. The core requirements hold without
  them.
