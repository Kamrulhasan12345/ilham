# Ilham ETL

The pipeline moves data from the source files to `staging`, then to `corpus`. It
then fills a synthetic `app` layer.

The pipeline is checked from end to end against PostgreSQL 16, on the real
corpus. That corpus is **14,901 hadiths** from Sahih al-Bukhari and Sahih Muslim.
It holds 139,629 chain positions, 20,957 narrator profiles, and 87,996 narrator
mentions.

## Get the data

The source is the **Ifta Sunnah Hadith & Narrators Dataset** on Kaggle. You must
download it by hand. Kaggle needs API credentials for each account. To make
everyone set those up would replace one documented step with a worse one.

Put these three files in `etl/raw/`. Do not use subdirectories.

| File | Size |
|---|---|
| `sahih-al-bukhari.json` | 322 MB |
| `sahih-muslim.json` | 339 MB |
| `ifta_narrators.json` | 16 MB |

The directory `etl/raw/` is in `.gitignore`. 710 MB cannot live in the
repository, and GitHub refuses a file above 100 MB. The file `sources.json` holds
the sha256 of each file. The command `npm run verify` is what makes "we loaded
the same bytes" a claim you can check.

### Optional: the English text

**LK-Hadith-Corpus** fills `corpus.hadith_translations`. Put its CSV files here.
Keep the book directories:

```
etl/raw/lk-translations/bukhari/Chapter1.csv … Chapter97.csv
etl/raw/lk-translations/muslim/Chapter1.csv  … Chapter57.csv
```

That is 154 files, 47 MB, and 14,659 rows.

If you leave it out, stage 14 does nothing. The corpus then loads Arabic only,
and every reader falls back to Arabic. With it, **95.3%** of the hadiths carry
English. Bukhari is 96.9% and Muslim is 93.8%.

The loader takes the book from the **directory name**, not from the file name. It
reports a directory it does not recognise. It never guesses.

The command `npm run verify` does not check these files. It pins the required
Ifta sources only. `sources.json` records the tree hash under
`optional_datasets`. To confirm that you have the same copy, run:

```bash
cd etl/raw/lk-translations
find . -name '*.csv' -type f | LC_ALL=C sort | xargs sha256sum | sha256sum
```

**If you need a working database and not a new corpus**, you don't need any of
the above. The repo carries a pre-built dump at `db/ilham.dump` (or the
`db/ilham.sql.gz` fallback) — a plain checkout plus `../db/run_container.sh
bootstrap` restores it in seconds. No Kaggle account needed unless you're
rebuilding the corpus from scratch or refreshing the dump after a schema
change (regenerate it with `../db/run_container.sh dump` and commit the
result).

## Run order

```bash
npm install
cp .env.example .env               # the defaults match db/run_container.sh

../db/run_container.sh test        # PostgreSQL 16 + schema + smoke test
npm run verify                     # hash the raw files, record provenance
npm run doctor                     # preflight: encoding, schemas, JS/SQL parity

npm run profile                    # 1. inspect the source. READ THE OUTPUT.
npm run rankmap                    # 2. write build/rank_map.sql, review by hand
psql -f rank_map.sql               #    (a curated map is already committed)
psql -f narrator_overrides.sql

npm run all                        # 3. extract + load + transform
npm run seed                       # 4. app layer, through the procedure and triggers

psql -f ../db/05_post_load.sql     # 5. seal the corpus, delete staging — ONE TIME
```

The files `rank_map.sql` and `narrator_overrides.sql` load into `staging`. Run
them again after each `run_ddl.sh` rebuild. They survive `npm run load`, which
truncates only the tables it fills.

The commands `profile` and `rankmap` stay manual. Both write output that a person
must read before the next step means anything.

## Why `profile` and `doctor` run first

`profile` answers, from the data, the questions that the pipeline would otherwise
guess. It also detects the field names of the source instead of an assumption.

`doctor` checks the environment: UTF8, the schemas, and that the JavaScript and
SQL copies of `normalize_arabic` still agree. **A difference there is silent.**
The projections of `profile` become optimistic fiction while the real load
resolves less.

The adapter reports what it could not map and what it did not use. A wrong guess
therefore appears as a printed line, not as a column of NULLs.

## What the real data changed

The team checked the pipeline against fixtures before the Ifta files arrived.
Against the real source it would have loaded **nothing**. There were three
reasons, and all three were silent.

**Every hadith was rejected.** The file `shape.js` had no candidate for
`hadith_text`, `hadith_text_diac`, `matn_text`, or `matn_text_diac`. All four
text fields resolved to `undefined`, so every record failed the `no_text` guard.

**Resolution pass B was dead.** The mentions field resolved to `narrators`. That
field exists, but it holds bare display strings with no identifiers. The field
that carries `[surface_plain, surface_diac, narrator_id]` is `names`. Nothing
failed. The extract simply wrote zero mention rows.

Detection now **tests** each candidate for usable narrator identifiers. It no
longer trusts the first name that matches.

**The anʿana penalty could never fire.** The Ifta chain nodes are bare strings and
carry no sigha, so `transmission_word` was NULL on every link in the corpus. The
sighas live in a parallel `narration_words` array, in the reverse order of the
chain. See `alignTransmission` in `src/extract.js`.

## Results on the real corpus

**Resolution.** 99.58% of the non-compiler positions resolved.

| Code | Meaning | Count |
|---|---|---:|
| A | A unique canonical name match | 116,848 |
| B | A positional zip | 440 |
| C | The name matched, but ambiguously | 437 |
| X | No match | 54 |

Pass A dominates. The Ifta chain strings are already disambiguated forms, so they
match `narrators.name` much better than the fixtures suggested.

The value of pass B is now mostly as an **independent check**. 49,685 positions
resolved by both methods, and the two agreed on **99.23%**.

**Transmission words.** The loader aligned 48,882 sighas across 9,384 of the
10,648 single-sanad hadiths, which is 88.1%. 19,838 links normalise to
<span dir="rtl">عن</span>. That is 40.6% of the links that carry a sigha, so the
penalty fires about where the fixtures predicted.

A multi-sanad hadith gets NULL. The array `narration_words` is one flat list, and
it has no marker for the end of a chain. A wrong sigha then changes
`chain_strength` with no sign of an error.

**Grades.** 98.57% of the chain positions carry a rank code, from four passes:

| via | Rule | Ibn Hajar | al-Dhahabi |
|---|---|---:|---:|
| `E` | The whole string matches | 257 | 198 |
| `T` | The first word matches | 7,943 | 3,815 |
| `S` | The tabaqa says Companion | 124 | 399 |
| `O` | A per-narrator override | 8 | 2 |

The token rule does the work. The grades are compound verdicts, such as
<span dir="rtl">ثقة حافظ فقيه , إمام حجة …</span>, and the first word carries the
judgement. About 41 map entries therefore do what about 1,300 exact rules would
do.

`S` and `O` exist because **the sources do not grade the eminent**. They write
praise instead. 178 narrators hold 16.8% of all chain positions, and they are
exactly the giants. al-Zuhri appears in 3,453 positions and Abu Hurayra in 3,538.

`chain_strength` takes the weakest link. One ungraded al-Zuhri would therefore
cap every chain he appears in at the neutral 0.50. The metric would score the
*strongest* isnads lowest. That is an inversion, not a coverage gap.

Over a sample of 2,000 hadiths, `chain_strength` now runs from 0.10 to 0.95 with
13 different values. The values group at 0.90 to 0.95, which is what you expect
of the two Sahihs.

**Reproducibility.** A full teardown and rebuild gives all 78 metrics again, with
identical values. This is also the regression test for the determinism of pass A.
An `UPDATE … FROM` that picked an arbitrary row would appear here.

## Who does what

Node does **structural** work only: it turns nesting into rows, removes the front
matter, removes the `"N - "` prefix, sequences the chapters, and aligns the
transmission words.

SQL does **every semantic** transform: dimension extraction, resolution,
normalisation, grade mapping, and translations.

Resolution is a join against 21,000 profiles. In SQL you debug a join with a
query. In JavaScript you debug it with `console.log`.

## Commands

| Command | Effect |
|---|---|
| `verify` | Hashes `raw/*` against `sources.json`. Records the provenance in `corpus.etl_metrics` |
| `doctor` | Preflight. It fails loudly before anything writes |
| `profile` | Reads the source files. It writes nothing to the database |
| `rankmap` | Writes `build/rank_map.sql` for review by hand |
| `extract` | Source files → `build/*.csv`, streamed |
| `load` | `build/*.csv` → `staging`, through `COPY` |
| `transform [stage]` | SQL stages 10 to 19, or one named stage |
| `seed` | The app layer. It needs a loaded corpus |
| `all` | extract + load + transform |

Every SQL stage truncates its own targets and owns its transaction. You can
therefore rerun any one alone. Use `npm run transform -- 12_resolve` while you
work on resolution, without a replay of the corpus load.

## The seeding rule

Use the machinery. Never go around it.

- Assignments go through `CALL app.assign_study_set`.
- Progress changes are `UPDATE` statements, so both triggers fire.
- Review sessions run inside an explicit `BEGIN` and `COMMIT`.

The seed then **recomputes `student_stats` on its own and fails if the result
disagrees with the trigger**. That is the difference between a demonstration of a
trigger and the mere presence of one.

The last run: 7 procedure calls gave 1,650 progress rows, 24 review
transactions, and 955 audit rows. No row had a missing actor. The stats showed no
difference.

## Notes

- **Memory.** The books are 322 MB and 339 MB. A `JSON.parse` of one needs several
  GB. The file `src/json-stream.js` yields the records one at a time, and the
  peak heap is about 260 MB.

  It uses `StringDecoder`, not `buf.toString()`. A 4 MB read almost never ends on
  a character boundary, and Arabic takes two bytes for each letter. To decode each
  chunk on its own corrupts the letter across the seam.
- **`raw_doc` is off by default.** The Ifta records carry `takhreej`,
  `comparisons`, and `features`, about 15 KB each, and no transform reads them.
  Set `ILHAM_KEEP_RAW_DOC=1` to switch it on while you debug the source shape.
- The `staging` types stay strict. A `COPY` that stops on one bad row is the
  correct failure. The fix is the `profile` preflight, never a looser column.
- Nothing is dropped in silence. Everything rejected goes to `staging.rejects`
  with a stage and a reason. A **missing optional field is not a reject**. The
  reject ledger is used for count reconciliation and must agree with it.
- `corpus.etl_metrics` survives `DROP SCHEMA staging` on purpose. It holds the
  source sha256 hashes. After the seal, those hashes are the only record of which
  bytes produced the corpus.
