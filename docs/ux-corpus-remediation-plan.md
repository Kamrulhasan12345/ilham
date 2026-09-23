# UX and corpus-language remediation plan

Date: 2026-09-24. This file records reported problems, their root cause in
the current code and data, and a concrete fix plan for each. Use this file
as the work order. Update `docs/frontend-gaps.md` when a phase closes.

## Problem 1: the site looks unstyled — CLOSED 2026-09-24

Closed by the frontend redesign
(`docs/superpowers/plans/2026-09-24-frontend-redesign.md`, branch
`feat/frontend-redesign`): new `Card`/`PageHeader`/`Menu` primitives now
cover collections, chapters, circles, notes, and the nav. Original root
cause and fix plan kept below for the record; do not re-open for these
routes.

**Root cause.** The frontend does not lack a style system. It has one:
CSS Modules plus design tokens in `frontend/src/styles/tokens.css`,
`reset.css`, and `base.css`, imported once in `frontend/src/main.tsx:7-9`.
A `scripts/check-token-literals.mjs` check bans raw color and size literals
outside `tokens.css`. Most `ui/*` and `domain/*` components use this system
correctly.

The problem is adoption, not absence. Some routes skip the system:

- `frontend/src/routes/_authed/search.tsx:44` — the page root is a bare
  `<div>`/`<h1>` with no class name at all.
- `frontend/src/routes/_authed/narrators/$narratorId.tsx:143` — uses
  `className="label"`, a raw string, instead of an imported CSS Module
  class like every other component. This class matches no stylesheet, so
  the label renders with browser defaults.

**Fix plan.**

1. Grep every route file for a JSX root with no `className` and for any
   `className="..."` that is a bare string, not `styles.xxx` from an
   imported `.module.css`. Command:
   `grep -rn 'className="[a-z]' frontend/src/routes`
2. For each hit, either move the markup into an existing `ui/*` or
   `domain/*` component (preferred — Button, Field, Table, HadithList, etc.
   already exist and are token-correct), or add a small `.module.css` next
   to the route file and import it.
3. Re-run `npm run build` in `frontend/` after each fix. The token-literal
   check fails the build if a fix reintroduces a raw literal, which is the
   regression guard already in place — keep it.
4. Do this route by route, in one pull request per route group (search,
   narrators, analytics), so review stays small.

Effort: about 20 to 40 minutes per broken route, once you have the grep
hit list.

## Problem 2: search only matches Arabic text

**Root cause.** `backend/src/modules/hadiths/hadiths.model.ts:34-37` and
`:74-77` build the search predicate as:

```sql
corpus.normalize_arabic(text_plain) LIKE '%' || corpus.normalize_arabic($n) || '%'
```

This is the only predicate. It never touches `corpus.hadith_translations`
(the English text) or `corpus.narrators.name_en`. The frontend confirms
this is a known, deliberate limit today:
`frontend/src/routes/_authed/search.tsx:56` labels the field "Search the
Arabic text." The new `frontend/src/domain/HadithPicker/HadithPicker.tsx`
(added in the 2026-09-24 redesign, used by the notes page) calls this same
`GET /hadiths?q=` endpoint, so it inherits the identical Arabic-only limit
— fixing this problem fixes both call sites at once, no separate work
needed for the picker.

The English text is not missing. Per `docs/data-and-etl.md`, ETL stage 14
already populates `corpus.hadith_translations` for about 95.3% of hadiths.
The gap is a missing join and predicate, not missing data.

**Fix plan.**

1. In `hadiths.model.ts`, add a second predicate that matches
   `corpus.hadith_translations.text` (join on `hadith_id`) with a plain
   case-insensitive `ILIKE`. English needs no diacritic normalization, so
   this is simpler than the Arabic path — do not reuse
   `normalize_arabic()` here.
2. Combine the two predicates with `OR`, and only apply the Arabic side
   when the query string contains Arabic script (a cheap Unicode-range
   check), so an English query is not silently normalized as Arabic and an
   Arabic query does not scan the English table for nothing.
3. Add a GIN trigram or full-text index on `hadith_translations.text` if
   the corpus size makes `ILIKE '%...%'` slow — check with `EXPLAIN
   ANALYZE` first. Read-only `corpus` schema, so this is a one-time
   migration in `db/`, not a runtime write concern.
4. Update the search route label in `search.tsx:56` to say the field
   searches both languages, and drop the Arabic-only hint.
5. Decide, and write down in this file once decided, whether narrator name
   search belongs in the same box or a separate narrator search (Problem 3
   makes this an open question, since `name_en` coverage is low).

Effort: about half a day, most of it in the index/performance check.

## Problem 3: narrator names show only Arabic

**Root cause.** This is a data-population gap, not a missing code path.
The full pipeline already exists end to end:

- `db/01_corpus.sql:85` — `narrators.name_en` is a real, nullable column.
- `backend/src/modules/narrators/narrators.model.ts:10` — the query already
  selects `name_en`.
- `IsnadChain.tsx:122` and `narrators/$narratorId.tsx:143` — the frontend
  already renders `name_en` when present.

The reason it never shows: `docs/prd.md:291` records MIS-sourced
`name_en` validation as a stretch goal that was cut from this term's
scope, and the committed ETL has no stage that actually populates
`name_en` for any row. Confirmed against the live corpus (2026-09-24):

```sql
SELECT count(*) FILTER (WHERE name_en IS NOT NULL), count(*) FROM corpus.narrators;
-- 0 of 20,957
```

Not partial coverage — zero. The column is real and the display code is
real; there is no data behind it at all, anywhere in the corpus.

One more real gap, smaller and code-side:
`frontend/src/routes/_authed/analytics/top-narrators.tsx` never requests
or renders `name_en` even where it does exist (lines 11, 73, 93) — it
only shows `display_name`.

**Fix plan, in order of effort:**

1. **Cheap, but shows nothing until step 2 lands.** Fix `top-narrators.tsx`
   to select and render `name_en` next to `display_name`, matching the
   pattern already used in `IsnadChain.tsx` and `$narratorId.tsx`. Still
   worth doing — it costs nothing — but with 0 of 20,957 rows populated
   (confirmed above), it renders no visible change until an English-name
   source actually exists. Do not treat this step as "fixing" the
   complaint on its own.
2. **Medium.** If the MIS dataset (named in `docs/prd.md` and
   `docs/data-and-etl.md` as the source for narrator English names) is
   available, write one new ETL stage that joins it in and backfills
   `name_en` for matched narrators, the same pattern stage 14 already uses
   for hadith text. This is additive to the existing pipeline; it does not
   touch `staging` retention rules or the `corpus` write-lock.
3. **If MIS is out of scope this term**, say so explicitly in
   `docs/prd.md` (it already is, at line 291) and stop here — do not build
   a bespoke transliteration or translation step. That would be new,
   ungraded, unreviewed work invented to paper over a data gap the PRD
   already scoped out.

## Problem 4: chapter names have no English at all

**Root cause.** This is not a cut feature like Problem 3 — no dataset in
this pipeline ever carried a chapter heading in English. Confirmed
2026-09-24:

- `corpus.chapters` has exactly `chapter_id, collection_id, seq, title_ar`
  (`db/01_corpus.sql`). No `title_en` column exists.
- LK-Hadith-Corpus, the one dataset that supplies English text at all,
  gives only hadith body text (`staging.lk_hadiths`:
  `lk_row_id, book_slug, hadith_num, text_en, arabic_text, arabic_matn`).
  Its Arabic fields exist solely to text-match against
  `corpus.hadiths.text_plain` for the translation join — LK carries no
  chapter structure, no narrator names, nothing else.
- `grep -rn "title_en" etl/ db/` matched nothing chapter-related. No ETL
  stage, past or present, ever attempted this translation.

**Fix plan.** Not a code fix. This needs a new data source — either find
a dataset that translates Sahih al-Bukhari's and Sahih Muslim's chapter
(باب) headings, or accept the ~180-heading translation as manual curated
work, the same way `etl/rank_map.sql` and `etl/narrator_overrides.sql` are
committed, curated files today. Either path is new scope, not a bug fix:
do not start it without confirming it is wanted, since it is real,
non-trivial work (dataset sourcing or manual translation + review) for a
field that never had English at all.

## Sequencing

Problem 1 is closed. Next: Problem 2 (English search — backend-only,
fixes both the search page and the notes picker in one change), then the
cheap `top-narrators.tsx` display fix from Problem 3 (do it, but expect
no visible effect until data exists). Only take on the MIS ETL stage in
Problem 3, or the new data-sourcing work in Problem 4, if narrator English
names or chapter English titles are graded or explicitly requested —
otherwise both stand as documented, confirmed gaps, not bugs to fix.
