# Frontend redesign: apply the design system everywhere, English-first

Date: 2026-09-24. Status: approved for planning.

## Problem

`docs/design/DESIGN.md` and `docs/design/specimen.html` already define a
real design system: named colour and type tokens (`frontend/src/styles/
tokens.css`), a two-tier grouped topbar, a fixed apparatus rail, a
chain-mark spine, and working components (`Button`, `Field`, `Input`,
`Dialog`, `HadithList`, `IsnadChain`). Pages that use it — hadith detail,
review, analytics — look intentional.

Several pages never use it. Live screenshots of the running app
(2026-09-24) confirm:

- `/collections`, `/collections/$slug` (chapters) — a bare `<ul><li>` list
  in the top-left corner of an otherwise empty page. No card, no table, no
  width constraint.
- `/circles`, `/notes` — same pattern: unstyled form, unstyled list.
- `/search`, `/narrators` — the query input box renders the literal string
  `undefined`, and `/narrators` fires a real request with `q=undefined` in
  the URL on load. This is a bug (an uncontrolled input defaulting to the
  literal value), not a style gap, and needs a code fix, not a restyle.
- Collections show Arabic title first, English second, backwards from the
  "English leads" ordering everywhere else. Hadith rows only ever show
  the Arabic `text_plain`; the English translation
  (`corpus.hadith_translations.text`, ~95.3% coverage per
  `docs/data-and-etl.md`) is never fetched or shown, on the list or the
  detail page.
- The account cluster (name/role display, `/me`, sign-out, admin-only
  "Verify teachers") is four separate flat items with no grouping. There
  is no settings destination at all.
- Notes creation asks for a raw numeric hadith ID typed by hand, with no
  way to find the hadith by name or text.

## Scope

In scope: every route under `frontend/src/routes/_authed/` that renders a
bare unstyled list or form (collections, chapters, circles, notes), the
nav shell, and the English-first data plumbing (frontend + the one
backend query change needed to fetch translations). Also in scope: fixing
the `undefined`-value search inputs.

Out of scope: chapter titles in English (no `title_en` column exists on
`corpus.chapters` — confirmed against `db/01_corpus.sql`; this needs new
ETL/dataset work, not a UI or query change, so it is not part of this
spec). Also out of scope: full-text English search across
`hadith_translations` (a separate, already-written plan exists at
`docs/ux-corpus-remediation-plan.md` — this spec's translation fetch for
display can share that backend groundwork, but does not implement search
matching).

## Approach

Extend the existing system; do not replace it. Two new generic primitives
close most of the gap, reused everywhere rather than styled per page:

- **`ui/Card`** — a bordered block on `--rail`/`--rule` tokens, for one
  collection, one chapter, one circle, one note-group. Replaces every
  bare `<li>`.
- **`ui/PageHeader`** — title plus an optional trailing count or action,
  replacing every bare `<h1>`.

Both take children/props generic enough for every list page in scope; no
per-page variant components.

### 1. Collections, chapters — English-first, card-based

- `collections/index.tsx`: one `Card` per collection. `title_en` leads
  (large), `title_ar` follows (smaller, `dir="rtl"`), hadith count as a
  quiet trailing figure. Drop the `[N hadiths]` bracket-mono styling in
  favour of the existing `--fs-label`/`--fs-body` scale.
  chapter titles stay Arabic-primary (see Scope) — but title styling
  moves onto tokens: seq as `--fs-label`, title as `--fs-ar-chapter` from
  the Arabic scale, in a `Card`, not a plain link in a plain `<li>`.

### 2. Hadith text — fetch and show the translation

- Backend: `backend/src/modules/hadiths/hadiths.model.ts` — add a `LEFT
  JOIN corpus.hadith_translations` to the existing list and detail
  queries, selecting `text` as `text_en`. `LEFT JOIN` because coverage is
  95.3%, not 100% — a hadith with no translation still returns Arabic
  only, per the existing "falls back to Arabic when absent" rule in
  `CLAUDE.md`.
- `HadithList` (`frontend/src/domain/HadithList/HadithList.tsx`): show
  `text_en` truncated to 120 chars when present (same truncation rule
  already used for Arabic), Arabic secondary and smaller. When `text_en`
  is null, Arabic is primary, unchanged from today.
- Hadith detail route: same ordering rule applied to the full text, not
  just the snippet.

### 3. Search and narrator inputs — fix the `undefined` bug

- `search.tsx` and `narrators/index.tsx`: the query input's controlled
  value traces back to `Route.useSearch()` producing `undefined` for `q`
  on first load instead of `''`. Fix at the `validateSearch` schema (
  `z.object({ q: z.string().catch('') })` or equivalent), not by patching
  the input's `value` prop — the schema is the actual source of the bad
  value, and patching the input alone would leave the `q=undefined` URL
  and the auto-firing bad request in place.
- While in this file: `search.tsx`'s "Search the Arabic text" label and
  hint change to describe both languages, matching
  `docs/ux-corpus-remediation-plan.md`'s Problem 2 fix — this spec's
  backend `LEFT JOIN` change is the same join that plan already
  describes, so land them together rather than twice.

### 4. Navigation — dropdown menus, full overhaul

Replace the current flat topbar (`frontend/src/app/Shell.tsx`) with three
menu buttons instead of grouped flat links:

- **Corpus ▾** — Collections, Search, Narrators.
- **Study ▾** — Circles, Study sets, Notes, Students (teacher/admin only).
- **Account ▾** — user name/role (display only, not a link), Settings
  (new — see below), Verify teachers (admin only), Sign out. This
  replaces the separate always-visible "Sign out" button.

New `ui/Menu` primitive: a button that toggles a `role="menu"` popover
positioned under it, closes on outside click and `Escape`, and supports
arrow-key navigation between `role="menuitem"` entries — one component,
used for all three menus. `aria-haspopup="menu"` and `aria-expanded` on
the trigger button.

**Settings** does not exist today. This spec creates a minimal
`/settings` route holding what already has no home: the theme switch
(currently a bare `ThemeSwitch` component sitting loose in the topbar)
moves here as the first and only setting. No other setting is invented
for this pass — YAGNI; add more when a concrete need exists.

The banner for an unverified teacher (`Shell.tsx:134-139`) is unaffected
by the menu change; it stays exactly where it is, outside the nav.

### 5. Circles — card list, no bare `<li>`

- `circles/index.tsx`: each circle renders as a `Card` (name, created
  date) instead of a plain link in a `<li>`. Empty and role-gated states
  (teacher-unverified banner, student view) keep their current copy,
  restyled onto `Card`/`PageHeader`, not rewritten.

### 6. Notes — a real hadith picker, not a raw ID field

- `notes/index.tsx`: replace the "Hadith ID" number input with a
  type-ahead picker that queries `GET /hadiths?q=...` (the same endpoint
  `search.tsx` uses) and lets the user pick a hadith by its
  English/Arabic snippet, storing the resolved `hadith_id` behind the
  scenes. This is the concrete fix behind "disgusting" — typing a raw
  database ID was never a usable flow, independent of styling.
- The note list groups by hadith already (existing `grouped` map in the
  file) — keep that grouping, restyle each group as a `Card` with the
  hadith's English/Arabic snippet as its header instead of a bare
  `Hadith [123]` link.

## Data flow

No schema change. One backend query change (§2, the `hadith_translations`
join) and one query-string schema fix (§3). Everything else is frontend
presentation and a new `Menu`/`Card`/`PageHeader` component set consuming
data the API already returns.

## Testing

- Existing route tests (`collections/index.test.tsx`,
  `circles/index.test.tsx`, etc.) assert on rendered text/links — update
  their queries to the new markup (e.g. text still findable inside a
  `Card`), not new tests for styling itself.
- `hadiths.model.ts`'s translation join needs one backend test asserting
  a hadith with a translation returns `text_en`, and one asserting a
  hadith without one returns `text_en: null` and unaffected `text_plain`.
- The `q=undefined` fix needs a regression test: loading `/search` and
  `/narrators` with no query string must not produce a network request
  containing the string `undefined`.
- `ui/Menu` gets its own small test: opens on click, closes on outside
  click and `Escape`, arrow keys move focus between items.
- No visual/screenshot test infra exists in this repo; verification is
  manual (`npm run dev` + browser), matching how this session verified
  the current bugs.

## Sequencing

1. §3 (fix `undefined` bug) — smallest, a real correctness bug, do it
   first regardless of anything else.
2. §1–§2 (`Card`/`PageHeader`, collections, chapters, hadith English
   text) — highest visual-impact, user's stated top priority.
3. §4 (nav menu overhaul).
4. §5–§6 (circles, notes).

Each step ships independently; nothing in a later step blocks an earlier
one.
