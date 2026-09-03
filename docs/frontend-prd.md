# Ilham — frontend PRD

**The React application over the Ilham API**

**Companion files:** `docs/prd.md` (the product and the graded requirements),
`docs/backend-prd.md` (the API, on the `docs/backend-prd` branch),
`docs/database.md` (the schema),
`docs/design/README.md` (the design rules), `docs/design/specimen.html` (the
design system), `docs/design/demo.html` (a working prototype).

`docs/backend-prd.md` is the plan of record for the API. It supersedes the
Hono scaffold in `backend/`. Where this document and that one disagree, that one
wins.

This document uses ASD-STE100 Simplified Technical English.

---

## 0. Summary

The frontend is a React application over an Express 5 API and one PostgreSQL
instance. It shows a finished read-only corpus and a small read-write study
layer.

The corpus is large and complete: 14,901 hadiths, 20,957 narrators, 139,629
chain positions, 5,158 chapters, and 2 collections. English text covers 95.3%
of the hadiths. **The frontend never writes to the corpus.** The database role
holds no write grant on `corpus.*`.

The study layer is small and transactional. Students join circles, collect
hadiths into study sets, complete assignments, and record reviews. Teachers
assign work and check it. An admin verifies teachers.

One person builds the whole frontend. See §12.

---

## 1. Goals and non-goals

### Goals

1. A reader who knows no hadith science understands every default screen. The
   scholarly apparatus stays available behind one control.
2. The study loop works from end to end: register, enrol, assign, review, and
   check.
3. The interface reports classical grades and gives no religious judgement. It
   says so where a reader can see it.
4. **The design system is replaceable.** A new palette, a new type stack, or a
   new component skin changes one layer and no application code. See §4.
5. The application runs in Docker from the first day. The same topology serves
   the demonstration and a public host.

### Non-goals

- No corpus writes, ever.
- No offline mode and no service worker.
- No Arabic interface. The interface speaks English. The corpus speaks Arabic.
- No native application.
- No new authenticity rulings. `docs/prd.md` §1 forbids them.

---

## 2. Users and permissions

| Role | Enum | Can do |
|---|---|---|
| Student | `student` | Read the corpus. Build study sets. Complete assignments. Record reviews. Write notes. |
| Teacher | `teacher` | Everything a student does. Run circles. Enrol students. Assign sets. Override progress. |
| Admin | `admin` | Everything a teacher does. Verify a teacher. |

The three roles are disjoint. `app.users.role` carries a CHECK constraint, and
each child table repeats it. Nobody holds two roles.

**A teacher starts unverified.** `app.teachers.is_verified` defaults to false.
An unverified teacher builds sets, writes notes, and reviews students. An
unverified teacher does **not** create a circle. The trigger
`trg_circles_teacher_verified` applies the rule in the database. The interface
reports the rule. The interface never tries to work around it.

Three teacher states exist, not two. A verified teacher can lose verification.
The existing circles keep running, because the gate applies to a new circle
only.

### Visibility

- A student sees only their own study data.
- A teacher sees their own circles.
- One student never sees another student's private study.
- Every signed-in user reads the whole corpus.

---

## 3. Stack

### 3.1 Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | **Vite + React + TypeScript** | Fast, simple, and the base that TanStack Router expects. |
| D2 | **TanStack Router**, file-based routes | See §3.2. Type-safe params and search params, and a predictable file layout. |
| D3 | **TanStack Query** | Loading, error, and empty states on every screen without hand-written state. |
| D4 | **Plain CSS**, custom properties, CSS Modules | The design depends on Arabic type control and logical properties. See §4. |
| D5 | **No charting library** | See §3.3. |
| D6 | English interface, left to right. Arabic sits in `dir="rtl"` islands | The teammate, the grader, and every document here read English. |
| D7 | Logical CSS properties everywhere | A right-to-left interface stays reachable later without a rewrite. |
| D8 | A typed API contract, and **no mock layer** | The seed database holds better edge cases than a mock: an empty circle, 11 students with no statistics, 49 hadiths with no chain, 1,633 with no matn. Mocks drift. A database does not. |
| D9 | **A 15-minute JWT access token in memory, and an opaque refresh token in an httpOnly cookie** | `docs/backend-prd.md` §3 specifies it. The access token never touches `localStorage`, so a cross-site scripting attack cannot read it from storage. The refresh token is revocable through `app.refresh_tokens`. |
| D10 | One origin. Nginx serves the build and proxies `/api` | One origin removes CORS in production and keeps the refresh cookie first-party. The API still configures CORS with `credentials: true`, so a second origin stays possible later. |
| D11 | Three Docker services: `db`, `api`, `web` | The topology matches the demonstration and a public host. |
| D12 | Thin tests | See §13. |
| D13 | **Biome** for lint and format | One tool, one config file, and it is fast. |

### 3.2 TanStack Router, not TanStack Start

TanStack Start reached a **v1.0 Release Candidate in March 2026**. It is
feature-complete and its API is stable. It is a real option.

This project uses **TanStack Router alone**, which is the routing layer inside
Start. The reasons:

- Start renders on a server. This adds a fourth Node process to §5.1, or it
  replaces nginx. Decision D10 and D11 depend on nginx serving static files and
  proxying one path.
- The graded artifacts are SQL. Server rendering earns no marks in a database
  course, and it adds a second server to explain in the defence.
- The schedule is short. A release candidate moves faster than a stable
  release.

TanStack Router alone gives the parts that matter here:

- **File-based routes.** The file tree is the route table. An agent and a human
  both read it the same way.
- **Typed path and search parameters.** This application keeps `q`, `limit`,
  and `offset` in the URL. TanStack Router validates and types them. React
  Router does not.
- **Loaders that integrate with TanStack Query**, so a route prefetches its own
  data.

Move to Start later if server rendering becomes valuable. The route files
transfer without change, which is the point.

### 3.3 Charts: build them, do not install them

**TanStack Charts is alpha.** The current line is 0.x, and the documentation
warns that the API may change between minor releases. The older
`TanStack/react-charts` was **archived on 13 May 2026**. Neither belongs in a
graded project.

This project installs **no charting library at all**. Four reasons:

1. The four analytics visuals are not standard charts. Q2 is a dumbbell on a
   six-step ordinal axis. The chain-strength plot is a discrete dot matrix over
   the exact weights the function returns. Neither maps to a library primitive.
2. `docs/design/specimen.html` already implements all four in about 80 lines of
   CSS.
3. A library brings its own colours, fonts, and spacing. Each one fights §4.
4. A dependency that a grader asks about must be defensible. Hand-written SVG
   and CSS are defensible line by line, which requirement 9 asks for.

**The one exception is Canvas.** The corpus distribution strip draws 14 buckets
over 14,852 hadiths. Canvas suits it, and `demo.html` already draws it. Canvas
does not theme itself, so it must read the tokens at paint time and repaint when
the theme changes. §4.5 gives the rule.

### 3.4 Libraries the project uses

| Package | Job |
|---|---|
| `@tanstack/react-router` | Routing, typed params |
| `@tanstack/react-query` | Server state |
| `zod` | Validate every API response at the boundary |
| `@phosphor-icons/react` | Icons, regular weight |
| `vitest`, `@testing-library/react` | Tests |
| `@biomejs/biome` | Lint and format |

Nothing else without a written reason.

---

## 4. The design system is a replaceable layer

This is a requirement, not a preference. A change of palette, type stack, or
component skin must touch one layer and no page.

### 4.1 Four layers

```
Layer 0  tokens        CSS custom properties only. No selectors, no components.
            ▲
Layer 1  primitives    Button, Input, Field, Chip, Card, Table, Dialog, Toast…
            ▲          They read tokens. They know nothing about hadiths.
Layer 2  domain        IsnadLadder, GradeChip, StrengthPlot, VerdictBand,
            ▲          MasteryMeter, NarratorCard. They know hadiths.
Layer 3  routes        Pages. They compose. They carry no styling.
```

A layer imports only from the layer below it. A route never imports a token
directly. A primitive never imports a domain component.

### 4.2 The rule that makes a swap possible

**A colour, size, space, radius, or duration literal outside Layer 0 is a
defect.** Every value comes through `var(--token)`.

Enforce it. A CI check greps Layers 1 to 3 for a hex colour, an `rgb(`, or a
raw `px` outside a border width. The check fails the build. The design system
already passes this check: `specimen.html` and `demo.html` contain no raw hex
outside `:root`.

### 4.3 Files

```
frontend/src/styles/
├── tokens.css            ← Layer 0. The only file a new theme replaces.
├── reset.css
└── base.css              ← element defaults that read tokens

frontend/src/ui/          ← Layer 1. One folder per primitive.
│   Button/{Button.tsx, Button.module.css, index.ts}
│   …
frontend/src/domain/      ← Layer 2.
│   IsnadLadder/…
│   StrengthPlot/…
frontend/src/routes/      ← Layer 3. TanStack Router file-based tree.
```

Copy the `:root` block from `docs/design/specimen.html` into `tokens.css`. That
block is the source of truth today. After the copy, `tokens.css` becomes the
source of truth and `specimen.html` becomes the illustration.

### 4.4 Swapping a design system

To change the whole look, replace `tokens.css`. Nothing else changes.

To change a component skin, replace one `*.module.css` in Layer 1.

To support two themes at once, add a second token block under a
`[data-theme="…"]` selector. The current tokens already do this for dark mode.

### 4.5 Rules that a swap must not break

These belong to the system, not to a theme.

1. **Arabic keeps its own scale and leading.** Naskh reads smaller than Latin at
   the same pixel size. Use `--fs-ar-*` and `--lh-ar`. Never reuse the Latin
   scale for Arabic.
2. **Mono means a database value.** Text in `--font-data` came out of the
   database unchanged: a grade code, a weight, a chain position, a date, an
   identifier, `hadith_num`. Never use mono for a label.
3. **Three semantic colours only.** `--sound`, `--fault`, `--warn`. Each carries
   meaning. None decorates.
4. **Never colour alone.** Add a shape, an icon, or a word.
5. **Canvas reads tokens at paint time** and repaints on a theme change. CSS
   re-themes itself. Canvas does not.
6. **The isnad ladder is one right-to-left object.** Put `dir="rtl"` on the
   list, not on each name.
7. **Give the ladder cells an explicit `grid-column`.** `display: none` on a
   grid child removes it from the grid, and auto-placement then shifts every
   later cell across.
8. **The node cell needs `align-self: stretch`.** The row is `align-items:
   start`, so without it the spine breaks into disconnected stubs.

---

## 5. Application architecture

### 5.1 Topology

```
browser
   │ https://<host>/          → the React build (nginx)
   │ https://<host>/api/…     → nginx proxies to api:3000
   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ web  nginx   │──▶│ api Express 5│──▶│ db  Postgres │
│ static build │   │ Node 20      │   │ 16           │
└──────────────┘   └──────────────┘   └──────────────┘
```

The browser sees **one origin**. It never calls the API host directly.

In development, Vite replaces nginx and `server.proxy` sends `/api` to the API
service. The origin model does not change between development and production.
This is deliberate, and §5.3 depends on it.

`compose.yaml` gains a `web` service. `db` and `api` already exist.

### 5.2 The data layer

```
route loader  →  TanStack Query  →  api client  →  zod parse  →  typed data
```

- One `apiFetch` wrapper adds `Authorization: Bearer <access token>`, sets the
  JSON headers, converts a non-2xx response into a typed error, and owns the
  refresh-and-retry rule in §5.3. Only `/auth/refresh` and `/auth/logout` send
  `credentials: 'include'`, because only those two read the cookie.
- Every response passes through a zod schema. A schema failure is a real
  failure, not a warning. The corpus is stable, so a failure means the contract
  moved.
- Query keys follow `['hadiths', { collectionId, chapterId, limit, offset }]`.
- `staleTime` is high for corpus data, because the corpus never changes at run
  time. Use `Infinity` for a hadith, a narrator, and a collection.
- Study-layer data uses the default `staleTime` and invalidates after a write.

### 5.3 Authentication

`docs/backend-prd.md` §3 owns this design. The frontend builds the client half.

**Two tokens live in two different places.**

| Token | Form | Where it lives | Lifetime |
|---|---|---|---|
| Access | A JWT. Claims are `sub`, `role`, `iat`, `exp`, and nothing else | **In memory only.** A variable behind the auth context | 15 minutes |
| Refresh | An opaque random string | An `httpOnly` cookie. JavaScript never reads it | 7 days |

**The access token never goes to `localStorage` or `sessionStorage`.** A reload
loses it, and that is correct. Step 1 mints a new one.

**The flow.**

1. At start, the application calls `POST /api/auth/refresh` with
   `credentials: 'include'`. A valid cookie returns a new access token, and the
   user is signed in. A 401 means no session, and the application shows
   `/login`.
2. `POST /api/auth/login` returns an access token and sets the refresh cookie.
3. Every other call adds `Authorization: Bearer <access token>`.
4. A 401 triggers one refresh and then one retry of the original request. A
   failed refresh clears the auth context and goes to `/login`.
5. `POST /api/auth/logout` deletes the stored token and clears the cookie. The
   client also drops the token it holds in memory.

**Refresh is single-flight.** Ten queries can fail with 401 at the same moment,
because the access token expires while the page is open. The client keeps **one**
pending refresh promise, and every waiting request awaits it. Without this rule
the application fires ten refreshes, and each one invalidates the token the
others just received.

**Cross-site request forgery is small here. It is not zero.**

- Every state-changing route reads the `Authorization` header. Another site
  cannot set that header, so those routes are safe by construction. This is the
  advantage of a Bearer token over a session cookie.
- `POST /auth/refresh` is the exception. It authenticates with the cookie alone.
  That one route needs `SameSite` on the cookie and an `Origin` check on the
  API.

**The token carries no name.** The claims are `sub`, `role`, `iat`, and `exp`.
The shell shows a name and an email, and a 15-minute token cannot supply them.
The API needs `GET /auth/me`. `docs/backend-prd.md` §5 does not list it. See
§8.2.

### 5.4 Guards

A route declares its requirement. The router checks it before the loader runs.

| Guard | Rule |
|---|---|
| `public` | Anybody. |
| `signedIn` | A session exists. |
| `teacher` | `role === 'teacher'` or `'admin'`. |
| `verifiedTeacher` | `teacher` and `is_verified`. |
| `admin` | `role === 'admin'`. |

A failed `signedIn` guard sends the user to `/login` and keeps the target URL.
After sign-in the application returns to the target.

A failed role guard shows a page that explains the rule. It does not redirect
silently, and it does not hide the destination. `docs/design/README.md` requires
this.

### 5.5 The error boundary

Each route has an error boundary. It shows what failed and one way forward. It
never shows a stack trace.

A 401 does **not** reach the boundary on the first attempt. §5.3 step 4 refreshes
and retries first. Only a failed refresh clears the auth context and sends the
user to `/login`.

---

## 6. Routes

The file tree is the route table.

| Route | Page | Guard |
|---|---|---|
| `/login` | Sign in | public |
| `/register` | Register | public |
| `/` | Redirect to `/collections` | signedIn |
| `/collections` | Collections | signedIn |
| `/collections/$slug` | Chapters | signedIn |
| `/collections/$slug/$seq` | Hadiths in a chapter | signedIn |
| `/hadiths/$hadithId` | Hadith detail | signedIn |
| `/search` | Search results (`?q=`) | signedIn |
| `/narrators` | Narrator list (`?q=`) | signedIn |
| `/narrators/$narratorId` | Narrator profile | signedIn |
| `/analytics` | Index of the questions | signedIn |
| `/analytics/top-narrators` | Q1 | signedIn |
| `/analytics/contested` | Q2 | signedIn |
| `/analytics/shared` | Q3 (`?a=&b=`) | signedIn |
| `/analytics/weakest-chains` | Q5 | signedIn |
| `/sets` | Study sets | signedIn |
| `/sets/$setId` | Set detail | signedIn |
| `/circles` | Circles | signedIn |
| `/circles/$circleId` | Circle overview (Q4) | teacher |
| `/circles/$circleId/assign` | Assign a set | verifiedTeacher |
| `/assignments/$assignmentId` | Completion (Q6) | teacher |
| `/review/$sessionId` | The review runner | signedIn |
| `/notes` | Notes | signedIn |
| `/me` | Account | signedIn |
| `/admin/verify` | Verification queue | admin |
| `*` | Not found | public |

**A hadith URL uses `hadith_id`.** `hadith_num` is `text`, it can read
`2564 a`, and it is not unique across collections. Never sort it as a number.

After each route change, move focus to the main region. A screen reader then
announces the new page.

---

## 7. Pages

Each page below gives: the job, the data, the default state, the other states,
and the actions. A page is not finished until it shows every state in §9.

### 7.1 Sign in — `/login`

**Job.** Get the user into the application.

**Fields.** Email (`type="email"`, `autocomplete="email"`). Password
(`type="password"`, `autocomplete="current-password"`, a show/hide control).

**Rules.** Allow paste. Allow a password manager. Never block either. Show one
error above the form after a failed submit, and move focus to it.

**Actions.** Sign in. A link to `/register`.

**States.** Idle. Submitting, with the button disabled and its label kept.
Failed, with a plain message.

### 7.2 Register — `/register`

**Job.** Create an account and choose a role.

**Fields.** Full name, email, password, and a role choice: student or teacher.
An admin account is never self-served.

**Copy for the teacher choice.** State the consequence before the choice, not
after: an admin verifies the ijaza or the institution before the first circle
opens.

**After submit.** A student goes to `/collections`. A teacher goes to
`/collections` and sees the waiting banner from §7.3.

### 7.3 The waiting banner — every page, for an unverified teacher

Not a page. A banner that the shell shows.

**Copy.** "Your teaching account is waiting for review. You can build study
sets, write notes, and review students. You cannot open a circle yet."

It is a `--warn` notice, not an error. The account works. One capability waits.

### 7.4 Collections — `/collections`

**Job.** The entry point to the corpus.

**Data.** `GET /collections`. Two rows today, extending to 33.

**Each row.** `title_ar`, `title_en` where it exists, the slug, and a hadith
count. `title_en` falls back to `title_ar`.

**Empty.** Not reachable with the shipped data. Still write it.

### 7.5 Chapters — `/collections/$slug`

**Job.** Move from a collection to a chapter.

**Data.** `GET /chapters?collection_id=`. 5,158 rows across two collections.

**The trap.** Many chapters carry the bare title <span dir="rtl">باب</span>.
**Always show `seq`.** Without it the chapters look identical and the page is
useless.

**Paging.** Server-paginated. See §7.24.

### 7.6 Hadith list — `/collections/$slug/$seq`

**Job.** Choose a hadith.

**Data.** `GET /hadiths?collection_id=&chapter_id=&limit=&offset=`.

**Each row.** `hadith_num` as text in mono. A one-line Arabic snippet from
`text_plain`, truncated. The chain strength as a short bar and a figure.

**A hadith with no chain shows "no chain" and no bar.** 49 hadiths have none.

### 7.7 Hadith detail — `/hadiths/$hadithId`

The signature page. `docs/design/demo.html` implements it.

**Data.** `GET /hadiths/:id` returns the hadith, one translation, the flat
isnad array, and `chain_strength`. **The array is flat and ordered by
`(sanad_no, position)`. The page groups it into chains itself.**

**Default view, for a reader who knows no hadith science:**

1. A left rail of metadata, in mono. On a phone the rail moves **below** the
   text.
2. The matn, large, in Naskh, right aligned. A vocalisation toggle switches
   `text_diac` and `text_plain`.
3. The English translation, or an honest statement that none exists.
4. **A plain sentence about the chain.** Strong, mixed, a weak link found, or no
   chain. A word, never a bare number.
5. **The disclaimer.** Ilham reports grades that classical scholars wrote
   centuries ago. It does not judge whether a hadith is authentic. A colour or a
   number is never Ilham's own opinion.
6. The isnad ladder. The Companion first, the collector last. Each narrator
   shows a name and one plain English line.

**Behind "Show grading detail":** the generation numbers, the raw Arabic
verdicts, the numeric weights, the provenance tiers, the discrete strength plot,
the arithmetic, and the distribution strip. The choice persists.

**More than one chain.** A segmented control switches chains and shows the
score of each. Mark which chain is strongest, because the strongest sets the
hadith score.

**Actions.** Add to a study set. Write a note. Open a narrator.

### 7.8 Search — `/search?q=`

**Job.** Find a hadith by its text.

**Data.** `GET /hadiths?q=`. **This endpoint does not exist yet.** See §8.3.

**Tell the reader what search does.** It removes the diacritic marks and the
tatweel, and it unifies the alif, ta marbuta, and ya forms. A reader who types a
vocalised word and gets an unvocalised result must know the match is correct.

**Empty result.** Name the two likely reasons and offer a way forward. Search
reads hadith text only. Offer a narrator search for the same string.

**The query lives in the URL.** TanStack Router types and validates it.

### 7.9 Narrator list — `/narrators?q=`

**Job.** Find a narrator.

**Data.** `GET /narrators?q=&limit=&offset=`. **This endpoint does not exist
yet.** The indexes do: `name_norm` and `display_norm` are generated columns on
`corpus.narrators`.

**Each row.** `display_name`, `name_en` where it exists, the generation, and the
number of chain positions.

**Exclude placeholders by default.** `is_placeholder` rows carry no name. Offer
a control to include them.

### 7.10 Narrator profile — `/narrators/$narratorId`

**Data.** `GET /narrators/:id`.

**Sections.**

1. **Profile.** `display_name`, `name_en`, kunya, lineage, relation, generation,
   school, and death date. **Omit a field with no value. Never print an empty
   label.** `date_of_death` is free text. Never parse it as a date.
2. **Grades.** Ibn Hajar and al-Dhahabi, each with the raw verdict and the
   mapped weight. Say which one the score uses, and say that the score uses the
   stricter of the two.
3. **Chains.** The hadiths this narrator appears in, paginated. Al-Zuhri appears
   in 3,453. **Never render every row.**
4. **Who they learned from and taught.** An adjacency table. **Do not draw a
   network graph of 20,957 narrators.**

**A placeholder narrator has every field NULL.** The whole page is one empty
state that explains the absence is the finding.

### 7.11 Analytics index — `/analytics`

A card for each question. **The card title is the question**, not the table
name: "Where do the two scholars disagree?", not "Contested narrators".

### 7.12 Q1 top narrators — `/analytics/top-narrators`

Horizontal bars, sorted down, capped at 15. **Print the cap.** A silent top-N
reads as "this is everyone". Exclude placeholders. State the concentration: 178
narrators hold 16.8% of all positions.

A sortable table sits under the chart. A chart alone does not reach a screen
reader.

### 7.13 Q2 contested narrators — `/analytics/contested`

A dumbbell on the six-step ordinal axis. A circle marks Ibn Hajar and a diamond
marks al-Dhahabi, so the chart never depends on colour. Sort by the gap, which
runs 1 to 5.

**Gloss the six Arabic grade words.** Without a gloss the axis of the flagship
chart is unreadable to an English-only reader.

### 7.14 Q3 shared narrators — `/analytics/shared?a=&b=`

Two hadiths side by side. Mark the shared narrators in both columns. **Never
reorder a chain to make the two line up.** The transmission order is the data.

Both hadiths come from the URL, so a result is shareable.

### 7.15 Q5 weakest chains — `/analytics/weakest-chains`

A list sorted up by `chain_strength`. **`chain_strength` is computed, not
stored**, so an ordered query recomputes for every row. Cap the list at 50 and
print the cap. Say that 49 more hadiths carry no chain and cannot be scored.

### 7.16 Study sets — `/sets` and `/sets/$setId`

**List.** The sets the user owns. `study_sets.owner_id` is polymorphic: a
student, a teacher, or an admin owns a set.

**Detail.** The hadiths in the set. **A set has no order and no per-item note.**
A set with no items is legal, and the empty state says what to do.

**Actions.** Create, rename, add a hadith, remove a hadith, delete. A teacher
assigns a set to a circle from here or from the circle.

### 7.17 Circles — `/circles`

A card for each circle. A teacher sees the circles they run. A student sees the
circles they joined.

**An unverified teacher sees the create control disabled** with the reason
beside it. The control is visible. `docs/design/README.md` forbids hiding a
destination in silence.

### 7.18 Circle overview — `/circles/$circleId`

**This page answers one question: how much of the corpus has each student
mastered?** Put the question on the page. Q4 and Q6 disagree about the same
student, and both are right.

**Table.** Student, mastered, assigned, share, last review.

- `mastered` counts **distinct hadiths** with `mastery >= 3`.
- A student with no progress row shows a real **0 of 0**. The share column
  refuses to divide. It never prints `NaN`.

**Two totals, two counting rules.** `mastered_count` counts distinct hadiths.
`review_count` sums over rows. Print the rule under each. Never present them as
one kind of number.

**Actions.** Enrol a student. Remove a student, with a confirmation that names
the consequence. Assign a set. Open an assignment.

**Empty.** One seeded circle has no students. The empty state offers enrolment
and warns that a set assigned to an empty circle reaches nobody.

### 7.19 Assign a set — `/circles/$circleId/assign`

**Fields.** The set, and a due date.

**Before submit, state the fan-out.** "This creates 400 obligations: 16 students
by 25 hadiths." The seed shows 400 rows from one call.

**The call is atomic.** `app.assign_study_set` owns its `COMMIT`. Show one
result, not a per-student tick.

**Assigning the same set again is a separate requirement.** Say so before
submit. Work done for the first assignment does not close the second.

### 7.20 Assignment completion — `/assignments/$assignmentId`

**This page answers a different question: what does each student still owe?**
Name the question.

Done against owed, for each student. A hadith mastered under another assignment
is still outstanding here, and the page says so.

**An assignment carries a due date and nothing else.** Overdue, due soon, and
upcoming are computed. Say that they are computed.

### 7.21 The review runner — `/review/$sessionId`

**Job.** Record a result for each hadith in one sitting.

**Progress.** "Hadith 5 of 12" and a bar. The count is known in advance, so the
bar never guesses.

**Three verdicts, and the schema allows no fourth:** `pass`, `partial`, `fail`.
Label each by what it means for the student, not for the row: "Passed",
"Partial", "Not yet".

**One transaction.** The session row, every result row, and the progress updates
write together. **Say so on screen.** A teacher who marks twelve hadiths and
loses the connection must know whether anything saved.

- Before: "Nothing is saved until you finish."
- Success: one message for the session.
- Failure: nothing was recorded, the verdicts are still on screen, and one
  control retries.

**Never show a tick for each hadith.** A tick implies twelve separate saves.

**A session has no reviewer when a student reviews alone.** `reviewer_id` is
nullable and means self-review.

### 7.22 Notes — `/notes`

A note belongs to a user and a hadith. **A note has no title, no privacy flag,
no `updated_at`, and no soft delete.** Do not design controls for them.

Group by hadith. Each note links to its hadith.

### 7.23 Verification queue — `/admin/verify`

A row for each unverified teacher: name, institution, specialisation, and the
date they applied. Institution and specialisation are nullable.

**Verifying is not destructive and needs no dialogue. Declining is, so it
confirms.**

### 7.24 Paging, everywhere

**No list endpoint returns a total count.** The responses are bare arrays.

Show "Showing 21–40". **Never show "page 3 of 47"**, because that number does
not exist. Add one line that says the total is not counted, so a reader does not
think it is hidden.

`limit` defaults to 20 and stops at 100. Use 50 for corpus lists.

**No virtualisation.** A page never holds more than 100 rows.

### 7.25 Not found and errors

**404.** Say what was not found and offer the collection index.

**Route error.** Say what failed and give one way forward. Never show a stack
trace.

**401.** Clear the auth context and go to `/login`, keeping the target.

---

## 8. The API contract

### 8.1 What exists today

| Endpoint | Parameters |
|---|---|
| `GET /collections` | none |
| `GET /hadiths` | `collection_id`, `chapter_id`, `limit`, `offset` |
| `GET /hadiths/:id` | `lang`, default `en` |
| `GET /narrators/:id` | none |

`limit` defaults to 20 and stops at 100. A bad `collection_id` returns 400. A
bad `limit` falls back to the default silently. **No total count anywhere.**

### 8.2 What the frontend needs

**Authentication.** `POST /auth/register`, `POST /auth/login`,
`POST /auth/refresh`, `POST /auth/logout`.

**`GET /auth/me` is missing from `docs/backend-prd.md` §5 and the frontend needs
it.** The access-token claims are `sub`, `role`, `iat`, and `exp`. They carry no
name and no email, so the shell cannot render the signed-in user. Add the
endpoint, or add the two fields to the claims. The endpoint is the better
answer, because a claim grows the token on every request.

**Corpus.** `GET /chapters?collection_id=`. `GET /narrators?q=&limit=&offset=`.
`GET /narrators/:id/chains`. `GET /narrators/:id/adjacent`. A `q` parameter on
`GET /hadiths`.

**Study.** Create, read, update, and delete for circles, enrolments, study sets,
set items, assignments, review sessions, and notes.
`POST /assignments` calls the procedure. `POST /review-sessions` runs the
explicit transaction. `PATCH /progress/:id` is the teacher override, and it sets
`ilham.user_id` first so the audit trigger records the actor.

**Analytics.** One endpoint for each of Q1, Q2, Q3, Q5, and Q6. Q4 is the circle
detail.

**Admin.** `GET /admin/teachers?verified=false`, `PATCH /teachers/:id`.

### 8.3 Search needs three database additions

Search does not work today. There is no `pg_trgm` extension, no normalised
column on `corpus.hadiths`, and no index that serves a substring match.

The one text index, `hadiths_matn_norm_idx`, is a **btree over an expression**
on `left(matn_plain, 200)`. It serves equality and prefix on that exact
expression only. It never serves `LIKE '%…%'`. It stops at 200 characters, and
it excludes the **1,633 hadiths where `matn_plain` is NULL**.

`docs/backend-prd.md` §8.2 owns the fix. It adds a new file, `db/06_search.sql`,
with an **expression index** and no new column:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX hadiths_text_trgm_idx ON corpus.hadiths
    USING gin (corpus.normalize_arabic(text_plain) gin_trgm_ops);
```

`corpus.normalize_arabic` is `IMMUTABLE`, so the expression index is legal.

**Do not edit `db/05_post_load.sql`**, because that file is destructive and it
already ran. `CREATE EXTENSION` needs the database owner, not `ilham_app`.

**Regenerate `db/ilham.dump` afterwards.** A fresh clone restores the dump, so
an index that is not in the dump does not exist for anybody else.

---

## 9. States the interface must show

Each state comes from the schema. The seed database contains most of them on the
first run.

### 9.1 The corpus

- A hadith with no chapter. The breadcrumb survives a missing middle.
- A hadith with no English text: 4.7% of the corpus. Show the Arabic. **Never
  show an empty English panel.**
- A hadith with no chain: 49 rows. `chain_strength` returns NULL.
- A hadith with more than one chain. **The transmission words are always NULL on
  these**, because the loader aligns words for single-chain hadiths only.
- A hadith with no matn split: 1,633 rows have `matn_plain` NULL.
- A narrator with no generation: 58% of the profiles.
- A narrator whom one scholar graded only. Ibn Hajar covers 41.5%. Al-Dhahabi
  covers 25.7%.
- A verdict that the rank map does not cover. The raw string exists and the code
  is NULL. **This does not change the weight.**
- A placeholder narrator. Every field is NULL.
- Four link states: resolved (`A`, `B`), ambiguous (`C`), unresolved (`X`), and
  the collector. **The collector always carries `X` and a NULL narrator. This is
  correct and it is not a failure.**
- `C` and `X` both mean "no link", for opposite reasons. `C` means the name fits
  more than one person. `X` means no profile matched.

### 9.2 The study layer

- Mastery runs 0 to 4. **Three or more counts as mastered.** This is the only
  threshold in the database, and the schema names no level. The frontend names
  them.
- A student holds an assigned row and a private row for the same hadith at the
  same time, each with its own mastery. A new assignment never resets private
  study. `assignment_id` is NULL for private study.
- A circle with no students.
- A student with no `student_stats` row. Treat it as 0 and 0, not as an error.
- Three teacher states: verified, waiting, and not verified with circles that
  still run.
- A deleted user. `audit_log.changed_by` has no foreign key, so a dangling
  reference is possible. Show "actor unknown".
- The audit trigger records the mastery change only, and the actor is
  best-effort. A batch job leaves it unset.

### 9.3 Numbers the interface must never present bare

`chain_strength` returns 0 to 1, or NULL. Over the real corpus the average is
**0.836**, the range is **0.10 to 0.95**, and only **13 distinct values** occur.

**A bare number reads as a probability.** A reader who sees `0.95` concludes
"95% likely true". A reader who sees `0.10` concludes "probably false". Ilham
makes no such claim, and `docs/prd.md` §1 forbids it.

Lead with a plain word. Say "This chain is strong", then give `0.95` as a
smaller detail.

**The weights, in order:** <span dir="rtl">ثقة</span> 0.95 ·
<span dir="rtl">صدوق</span> 0.80 · <span dir="rtl">مقبول</span> 0.60 ·
**ungraded 0.50** · <span dir="rtl">لين</span> 0.40 ·
<span dir="rtl">ضعيف</span> 0.25 · **unnamed 0.15** ·
<span dir="rtl">متروك</span> 0.10. An anʿana link takes 0.05 more.

Two facts follow, and a single good-to-bad ramp hides both: **an ungraded
narrator outranks <span dir="rtl">لين</span>**, and **an unnamed narrator
outranks <span dir="rtl">متروك</span>**. An unknown narrator is not an abandoned
one.

**The ring marks the row that sets the score. The colour follows the weight.**
Most of the corpus has its minimum at <span dir="rtl">ثقة</span>. A red row
there tells the reader that the strongest chain in the collection is full of
problems.

---

## 10. Accessibility and the quality floor

Every page meets these. They are not optional and they are not a later pass.

- Text contrast 4.5:1. A control boundary 3:1.
- A visible focus ring: 2px, ink, offset 2px. Never remove it.
- A pointer target of 24px or more. A coarse pointer gets 44px.
- No horizontal page scroll. Wide content scrolls inside its own box.
- `prefers-reduced-motion` stops all motion and shows the final state.
- Light and dark both work. Never define a colour inside a media query only.
- Every field has a visible label. A placeholder is not a label.
- An error sits under its field and is tied to it with `aria-describedby`.
- After a failed submit with several errors, focus a summary that links to each
  field.
- A chart has a table under it. A chart alone does not reach a screen reader.
- An icon beside a visible label is decorative and takes `aria-hidden="true"`.
  An icon alone in a control gives the control its accessible name.
- Never use an emoji as an icon.

### Motion

One animation for each view. **The isnad ladder draws in transmission order**,
one rung every 45ms, Companion first. This is not decoration. It encodes the
direction of transmission, which is the fact a new reader gets backwards.

Everything else is a 340ms fade at a 10px offset. Reduced motion removes it all.

---

## 11. Docker

Three services. `web` is new.

```yaml
web:
  build: ./frontend
  ports: ["8080:80"]
  depends_on: [api]
```

The frontend image builds in two stages: Node builds the static files, then
nginx serves them. Nginx also proxies `/api` to `api:3000`, which is what makes
§5.1 one origin.

`VITE_API_BASE` is `/api` in every environment. The frontend holds no host name
and no secret.

For a public host later: put TLS in front, keep `Secure` on the cookie, and
change nothing else. The topology already matches.

---

## 12. Ownership

`docs/prd.md` §7 splits the backend. **One person builds the whole frontend.**
The same person builds part of the backend.

The teammate keeps a backend half they can defend line by line: authentication
and the guards (requirements 1 and 2), circles and enrolment,
`app.assign_study_set` (requirement 6), and the circle-overview query.

Requirement 9 grades whether each member defends their own work. **Agree this
split with the instructor before week 8.** Do not leave it to the defence.

---

## 13. Tests

Write few tests. Write the right ones.

**Unit tests** for pure functions: the band that maps a strength to a word, the
due-date states, the grouping of a flat isnad array into chains, and the error
handling in the API client. A fault in any of these puts a wrong claim on the
screen.

**One integration test** for the review submit path. It is the seam between two
people, it must be atomic, and a silent failure there loses a student's work.

**One CI check** for §4.2: no colour or size literal outside Layer 0.

Do not write a component test for each screen. Do not add Playwright.

---

## 14. Build order

1. **Foundation.** Vite, TypeScript, Biome, TanStack Router, `tokens.css`, the
   shell, the API client, and the guards.
2. **Layer 1 primitives.** Button, Input, Field, Chip, Card, Table, Dialog,
   Toast, Pager.
3. **Authentication.** Login, register, the waiting banner, and the guards.
4. **Hadith detail.** The signature page, and the only page with a complete
   endpoint today. If the ladder does not work, nothing after it matters.
5. **Browse.** Collections, chapters, and the hadith list.
6. **The study loop.** Sets, circles, assignments, and the review runner.
7. **Analytics.** Q1, Q2, Q3, Q5, and Q6.
8. **Narrators and search.** Last, because both need a new endpoint and search
   needs a database change. **This is the safest work to leave unfinished.**

---

## 15. Risks

| Risk | What we do about it |
|---|---|
| One person builds everything on a short schedule | §14 puts the graded flows first and search last. |
| Cross-site request forgery on the refresh route | Every other route uses a Bearer header, which another site cannot set. `POST /auth/refresh` uses the cookie alone, so it needs `SameSite` and an `Origin` check. See §5.3. |
| Several requests refresh at the same time | The refresh is single-flight. One pending promise serves every waiting request. See §5.3. |
| A reader reads a strength number as a probability | §9.3. The word leads. The number follows. The disclaimer is on screen. |
| The design system becomes hard to change | §4. Four layers, one token file, and a CI check that fails on a literal. |
| Requirement 9 asks each member to defend their own work | §12. Agree the split early. |
| TanStack Router is newer than React Router | It is stable and it is v1. Pin the version. Read the release notes. Do not adopt Start during the build. |
| Search slips | It is last in §14 and it needs `db/06_search.sql`. The application works without it. |
| The corpus is read-only | The role holds no write grant. A write path fails at run time, not at review time. |

---

## 16. Decisions made without the author

These are reasonable and they are not settled. Change any one.

1. **A hadith URL uses `hadith_id`.** `hadith_num` is text, it is not unique
   across collections, and it can read `2564 a`.
2. **The access token lives in memory, not in `sessionStorage`.** A reload
   costs one call to `/auth/refresh`. Storage would survive the reload and
   would also survive a cross-site scripting attack.
3. **No list virtualisation.** The API caps a page at 100 rows.
4. **The researcher gets no separate interface.** Analytics is a section every
   signed-in user reaches. Only the verification queue is restricted.
5. **Corpus lists use a page size of 50**, against the API default of 20.
6. **No Storybook.** §4 makes the layers explicit, and `specimen.html` already
   serves as the living reference. Add Storybook only if a second person joins.
