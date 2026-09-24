# Ilham — frontend gap ledger

Status of the frontend against `docs/frontend-prd.md` on 2026-09-24. The
backend serves every endpoint this document needs, and the frontend now
renders every page in the route table.

## Closed 2026-09-24

**Design language.** The shell follows the specimen, not the stale sidebar
draft: two tiers, grouped labelled nav, three-signal current tab. All eight
Layer 1 primitives exist (Button with destructive, Input, Field, Chip, Tag,
Table, Dialog, Toast, Slider, Seg). Layer 2 holds IsnadChain, StrengthPlot
with the specimen foot arithmetic, Rail, VerdictBand, GenerationFilter,
HadithList, Bars, Dumbbell, ChainPair, DistributionStrip, State, and Crumbs.
`tokens.css` is the only file a new theme replaces; the token-literal check
runs in `npm run build`. The plot legend no longer bolds Arabic, the
unresolved names sit quieter and link nowhere, and every resolved name links
to its narrator.

**Hadith detail (§7.7).** Rail, breadcrumb, vocalisation Seg (persisted),
per-chain VerdictBand, chain Seg with strongest mark, generation filter with
readout and steppers, link ledger table, plot, canvas distribution strip
with table, and study actions (add-to-set, write-note with toast).

**Browse.** Collections print `hadith_count`. The hadith list prints the
strength bar, the figure, and “no chain” with no bar. Chapters always show
`seq`.

**Study loop.** Sets with set detail (rename, remove with confirm, delete
with confirm). Circle overview (mastered/assigned/share that refuses to
divide, last review, enrol, remove with confirm, assign entry). Assign flow
with the printed fan-out and the atomic-call note. Assignment completion
with computed due states and per-student review entries. Review runner
(`/review/new`) with decided-count progress, three labelled verdicts, one
atomic submit, and the session record page. Account (`/me`) with the teacher
verification state. Notes use Field/Input with a delete confirm. The verify
queue declines through a confirm dialogue.

**Analytics.** Index, Q1 bars with the printed cap and concentration, Q2
dumbbell with glossed axis and gap sort, Q3 pair that never reorders a
chain, Q5 with the printed cap and the unscored count. Every chart carries
its table.

**Search and narrators.** Arabic-normalised search with the honest empty
state and a narrator cross-link. Narrator list with placeholder control.
Narrator profile with rail, grades, paginated chains, adjacency table, and
the whole-page placeholder state.

**Quality floor.** Focus moves to `#main` on every route change. Route error
and 404 name the collection index. Forms use Field errors with
`aria-describedby` and focus the summary on failure. Dialogs trap focus
natively with a non-modal fallback. Toasts announce politely. Charts never
encode by hue.

**Tests.** 143 frontend tests green: unit tests for grading, grouping,
chain marks, the plot foot, the filter readout, Seg, VerdictBand, and the
API envelope, plus the review-submit integration test.

## Closed 2026-09-24 (frontend redesign)

A live browser pass on the running app found several pages that never
used the design system above: bare `<ul><li>` lists with no width
constraint, no `Card`, no hierarchy, and the query boxes on `/search` and
`/narrators` rendering the literal string `undefined`. Fixed:

1. **The `q=undefined` bug.** `z.coerce.string().catch('')` coerces a
   missing param to the *valid* string `"undefined"` before `.catch`
   ever runs. Both routes now use plain `z.string().catch('')`.
2. **`Card` and `PageHeader`** (new `ui/` primitives) replace every bare
   list and `<h1>` on collections, chapters, circles, and notes.
3. **English-first hadith text.** `hadiths.model.ts` now `LEFT JOIN`s
   `corpus.hadith_translations`; `HadithList` shows the English
   translation ahead of the Arabic snippet when one exists, Arabic-only
   otherwise. Chapter titles stay Arabic-only — no `title_en` column
   exists on `corpus.chapters`.
4. **Nav overhaul.** The flat topbar links became three `Menu` dropdowns
   (Corpus, Study, Account — new `ui/Menu` primitive), consolidating the
   loose Sign-out button and adding a new `/settings` route that now
   holds the theme switch.
5. **Notes.** The raw numeric Hadith ID field is gone; a new
   `HadithPicker` type-ahead (queries the existing `/hadiths?q=` endpoint)
   replaces it.

12 tasks, each with its own test, on `feat/frontend-redesign`. See
`docs/superpowers/specs/2026-09-24-frontend-redesign-design.md` and
`docs/superpowers/plans/2026-09-24-frontend-redesign.md`.

## Remaining, by choice

- No Storybook (§16 decision 6): `specimen.html` is the living reference.
- No route animation: motion is allowed, never required.
- The `/students` page exists with no PRD section that specifies it.
- Notes have no edit control. The PRD does not ask for one.

## Browser pass 2026-09-24 (real Chromium against the containers)

Login, collections, hadith detail, grading disclosure, search, analytics,
and account pass end to end. The pass caught three bugs no mocked suite
could see, all fixed and covered:

1. The Docker build passes an empty `VITE_API_BASE`, and `??` kept it —
   every app request missed `/api` (405). Now `resolveApiBase` with unit
   tests.
2. The API mounted `/study-sets` while the frontend calls `/sets` — every
   set call 404'd. Mount renamed (backend PRD §5.7 updated).
3. `$circleId.assign.tsx` nests under `$circleId.tsx`, which rendered no
   `<Outlet/>` — the overview answered the assign URL. Restructured to
   `$circleId/route.tsx` + `index.tsx` + `assign.tsx`, pinned by a nesting
   test.
4. `requireRole('teacher')` excluded the admin, against PRD §2. Admins now
   pass any role check (backend PRD §3.2 updated), pinned by a test.

The full study loop (register ×2, admin verify, circle, set, add-to-set,
enrol, assign) passes in the browser. The verify queue gained the missing
pager (§7.24) after the pass showed new teachers falling off the first
page.

## Closed backend gaps

Served and tested since the last ledger: per-link anʿana-adjusted `weight`
(same CASE as the function), per-link and per-narrator `generation`
(`db/09_generation.sql`: 8,690 mapped, 21 honest NULLs),
`GET /hadiths/strength-distribution` (14 buckets off the view), and the
regenerated dump carrying all three.
