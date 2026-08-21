# Ilham — speaker notes and defence (the study layer and the boundary)

This is the companion to [`plan-compact.md`](plan-compact.md). It covers **slide
4, the study layer**, and **slide 5, the boundary**. Those are the two slides in
this speaker's part.

It also holds a question bank for the *whole* design, because questions do not
respect the split of ownership.

---

## Part 1 — Your part: the flow

You own slides 4 and 5. That is **130 seconds**, two diagrams, and three spoken
points.

Everything before you was preparation. Slide 5 is where the thesis lands. Your
job is not to describe a diagram. Make one claim on each slide, then stop.

### The handoff

Your partner ends slide 3 on *"a chain walk is aggregation, not recursion."* Do
**not** say it again. Take the clicker and open with a turn, not a greeting:

> "That is the side that never changes. This is the side that changes
> constantly."

One sentence, and slide 4 is already justified. Never open with "so", "okay", "as
you can see", or your own name.

### Slide 4 — the study layer, 70 seconds

**Shape: narrate one walk-through, then point at two decisions.** Keep that
order. The walk-through buys you the right to make the two points. If you lead
with the points, they sound like trivia.

1. **The walk-through, about 25 seconds.** Trace it on the diagram with your
   hand. Use domain words, not table names.

   > "A teacher owns a circle. Students enrol in it. The teacher assigns a study
   > set to the circle, and that assignment makes the progress rows: one for each
   > student and each hadith."

   Four nouns, one path, from left to right. Then stop. Do not mention the notes,
   the review sessions, the stats, or the audit log. They are on the diagram, and
   they can stay there.

2. **Point one, specialisation, about 20 seconds.** Put your hand on the **ISA
   triangle** and hold it there while you speak.

   > "Users specialise into three disjoint subtypes. That is not cosmetic. A
   > foreign key that points at *teachers* instead of at *users* means that an
   > admin account cannot own a circle. The database enforces the role rule, and
   > no application code is involved."

   The phrase to land is **"structural, not procedural."**

3. **Point two, the grain, about 20 seconds.** Move your hand to **Progress**.

   > "Progress is grained for each student, each hadith, and *each assignment* —
   > not for each hadith. The same hadith assigned two times, in two circles or in
   > two terms, is two separate obligations that the student must discharge. It is
   > also why a later assignment never removes earlier private study."

4. **The bridge, about 5 seconds.** Your hand already moves toward the next
   slide.

   > "So that is the writing side. The question that is left is what it may
   > touch."

**Cut these, and keep them cut:** the trade-offs of inheritance, the two
compensating triggers, the partial unique indexes, the header-and-detail split of
the reviews, and `student_stats`. Each one is a *good answer to a question*. That
is exactly where it belongs.

### Slide 5 — the boundary, 60 seconds

This slide reads instantly, so **slow down**. It is the only slide where silence
helps you.

1. **Name what they see, about 15 seconds.**

   > "This is everything that the study layer knows about the corpus. Four
   > relationships, and all of them point at one entity: the hadith. A set
   > contains them, progress tracks them, a review tests them, and a note is about
   > one. That is the entire interface between the two halves."

2. **The consequence, about 20 seconds.** Say the grant out loud and slowly. Then
   let it sit for a moment.

   > "Because the interface is that narrow, the application role holds **select
   > only** on the corpus. Insert, update, and delete are revoked."

3. **The close, about 20 seconds.** This is the sentence that the whole talk
   exists for. Deliver it to the panel, not to the screen.

   > "I would leave you with one distinction: a convention against a guarantee. A
   > comment in the schema that says *do not write here* is a convention, and it
   > holds until somebody is in a hurry. A privilege that the role does not hold is
   > a guarantee. No application bug can undo it. Nothing in the corpus even knows
   > that the application exists."

4. Hand back, or go to slide 6. Add no filler.

### Delivery rules for these two slides

- **Point, then talk.** Put your hand on the diagram, and *then* start the
  sentence. If you talk while you hunt for the box, the panel watches your hand
  instead of listening.
- **Name three things at most on each diagram.** Everything that you name and
  that does no work costs you a point that does.
- **Never read the diagram out loud.** They can read. They cannot infer *why*.
- If you run over, cut the walk-through on slide 4 to one sentence. Never cut the
  close on slide 5.

---

## Part 2 — The five questions most likely to hurt

These are ranked by the damage that a bad answer does. Rehearse these five out
loud. You only need to recognise the rest of the bank.

### 1. "If nothing can write to the corpus, how do you ever correct a typing error in a hadith?"

The trap is that "read-only" sounds like "immutable", and immutable data is
indefensible. Separate the two ideas.

> "Read-only is a property of the **application role**, not of the data. We
> maintain the corpus out of band: a migration that runs as the owning role, or a
> new load. What the app role cannot do is write to it at runtime, and that is the
> thing that we want to guarantee. This is privilege separation, not
> immutability."

### 2. "You said `REVOKE`. If you never granted insert, what does a revoke achieve?"

A sharp examiner will ask this. If you lean on `REVOKE` alone, you lose the
point. Own the correction.

> "That is fair. The half that does the work is the **grant**, not the revoke. The
> app role holds `USAGE` on the schema and `SELECT` on the corpus tables, and
> nothing else. The revoke is defensive, and it also removes anything inherited
> from `PUBLIC`. The part that matters for the future is `ALTER DEFAULT
> PRIVILEGES`, so that a table added to `corpus` later does not arrive writable."

Never claim that the revoke stops a superuser or the table owner. It does not,
and to say so invites a follow-up that you will lose.

### 3. "`student_stats.mastered_count` is derived data. Is that not the denormalisation that you argued against?"

Concede the category, defend the choice, and name the cost.

> "It is denormalised, deliberately, and `app.progress` stays the single source of
> truth. Two things make it safe. A trigger maintains it, so the application never
> writes those counts and there is exactly one writer. And the trigger
> **recomputes** instead of applying a delta, so it is idempotent and it heals
> itself. The next fire corrects a missed one, where `count = count + 1` drifts
> forever."

Then get ahead of the real weakness before they find it.

> "The honest cost is that it is a row-level trigger. A fan-out that inserts five
> hundred progress rows recomputes that student's aggregate five hundred times. At
> our write volume that is fine. If it stops being fine, the fix is a
> statement-level trigger with transition tables, which recomputes one time for
> each statement. There is also no `DELETE` trigger, because nothing in the product
> deletes progress. If somebody adds a delete path, the trigger must be mirrored
> onto it."

To volunteer that is worth more than to survive it.

### 4. "What stops a teacher from reviewing a student who is not in their circle?"

At the schema level, **nothing**. `review_sessions` carries `student_id`,
`reviewer_id`, and `circle_id` independently.

Do not bluff. Take the hit, and immediately show that you know the fix, because
the fix is genuinely clean.

> "Today that is an application-layer check, which by my own argument on the last
> slide is the weaker kind. The structural fix is cheap. `enrollments` is keyed on
> `(circle_id, student_id)`, so a **composite foreign key** from `review_sessions
> (circle_id, student_id)` to it would make an out-of-circle review impossible to
> represent. And because `circle_id` is nullable, a private-study session, which
> has no circle, stays legal for free. A foreign key with a NULL column is not
> enforced."

The same gap exists on `assignments`. Nothing checks that the teacher of the
assigning circle owns the study set. The answer has the same shape: it is an
application check today, and the schema *could* carry it.

### 5. "Why table inheritance? One `users` table with a role column would be simpler."

They are right that it is simpler. Do not argue that inheritance is *better*.
Argue that it is the modelling requirement, made load-bearing.

> "IS-A specialisation was a requirement. The choice was between a decorative
> version and one that does work. This one does work. The subtypes hold genuinely
> different attributes, and a foreign key to a subtype enforces the role rule for
> free.
>
> The price is that PostgreSQL inherits columns and checks, but **not** primary
> keys, unique constraints, foreign keys, or identity. The schema restores each
> one: a shared sequence through an inherited default, a primary key and a unique
> constraint on each child, and two trigger functions for the two gaps that
> remain."

Then name the two gaps yourself, because that is the actual mark.

- **Email uniqueness across the subtypes.** Three per-table `UNIQUE` constraints
  do not stop the same email from existing one time as a student and one time as a
  teacher. Login would then be ambiguous. `assert_email_unique` checks against
  `app.users`, which scans the whole hierarchy.
- **Foreign keys to the supertype.** A foreign key to `app.users` is checked with
  `ONLY` semantics. It cannot see the rows in the children, and it rejects every
  real user. A table that references a *specific* subtype is unaffected. Only the
  genuinely polymorphic references, `study_sets.owner_id` and `notes.user_id`,
  need `assert_user_exists`.

Both failures are **silent**. They give bad data, not an error. That is why the
schema compensates for them instead of tolerating them.

---

## Part 3 — Question bank: the study layer (yours)

**"Why not just `(student, hadith)` for progress?"**
Because a hadith can be assigned two times, in two circles or in the same set
next term, and each one is a separate obligation. To merge them would make the
second assignment look complete on day one, only because the student worked that
hadith last term.

**"Then does a student's mastered-hadith count not count twice?"**
It would. That is why every query that counts *knowledge* uses
`count(DISTINCT hadith_id)`, and the stats trigger does too. A query that counts
*obligations* uses `count(*)`. Two different questions and two different counts.
The grain lets us answer both. A `(student, hadith)` grain could answer only the
first.

**"Why a surrogate key on `progress` instead of a composite primary key?"**
`assignment_id` is nullable, because NULL means private study, and a NULL cannot
sit in a primary key. Identity is therefore a surrogate, and two *partial* unique
indexes enforce uniqueness: one over the triple where `assignment_id IS NOT
NULL`, and one over `(student, hadith)` where it IS NULL. PostgreSQL 15 could
fold those into one `UNIQUE … NULLS NOT DISTINCT`. We kept the baseline at 14.

**"Why is `assign_study_set` a procedure and not a function?"**
Because it controls its own transaction. A PostgreSQL function cannot `COMMIT`,
and a procedure can. The fan-out inserts one assignment row, then one progress
row for each enrolled student and each hadith in the set. That must be
all-or-nothing, so the routine owns the commit.

**"What if it fails part-way through the fan-out?"**
The whole call stops and rolls back, and that includes the assignment row.

Add this before they ask: it carries **no** exception handler, on purpose. A
`BEGIN … EXCEPTION` block opens a subtransaction, and a `COMMIT` inside one fails
at run time with *"cannot commit while a subtransaction is active"*. The handler
broke the very guarantee that it looked like it added.

**"A procedure that commits — can the API call it inside its own transaction?"**
No, and that is the calling contract. You must call a procedure that contains
`COMMIT` at the top level. If you `CALL` it inside an open `BEGIN … COMMIT`
block, PostgreSQL raises *"invalid transaction termination"*. That is correct
behaviour. The routine owns its transaction boundary, so a caller cannot own it
too.

**"What if somebody calls it two times with the same arguments?"**
Every `CALL` makes a new assignment, so two calls deliberately make two
obligations. That is the grain decision again, not a fault. The `ON CONFLICT`
clause guards only a replayed fan-out *inside one* assignment. Private-study rows
sit under the other partial index, so existing mastery is never touched.

**"That is a `CROSS JOIN`. Is that not a cartesian-product bug?"**
It is the intended product, and it is bounded: the enrolled students in *this*
circle, by the hadiths in *this* set. That product **is** the definition of "who
owes what".

**"Can a student update their own mastery to 4?"**
Not through the product. Mastery changes come from a review, and the API
restricts who may write them. That is an application-layer rule, and I would
rather say so plainly than claim too much. The contribution of the schema is that
every mastery change goes to the audit log, so a teacher override or an unusual
jump is visible afterwards.

**"Why does the audit trigger watch `mastery` only?"**
Because it is the only field with consequences. The database maintains
`times_reviewed` and `last_reviewed`, and to audit them would be noise. Restraint
was part of the brief: one shadow table, watching the one column that a human
argues about.

**"`audit_log.changed_by` is nullable and has no foreign key. So the audit trail can be empty or wrong?"**
Yes, and it is best-effort by design. It reads a session variable that the API
sets for each connection, and that variable is unset for batch work or a `psql`
session.

The reason it is not trigger-checked, unlike `study_sets` and `notes`, is
specific. A trigger writes the audit rows from *inside* the progress trigger. A
failed actor check there would roll back the legitimate user write that it tried
to record. A change-history table must never be able to veto the change. It is a
history, not a security control.

**"Why two tables for reviews?"**
A review is one pedagogical event with many results. The session header carries
the context: who was reviewed, by whom, in which circle, and when. The items
carry the verdict for each hadith, so one session can test ten hadiths with a mix
of pass, partial, and fail.

It is also the natural multi-table transaction. The session, the items, and the
progress update commit together or not at all.

**"Why are `reviewer_id` and `circle_id` nullable?"**
Both NULL means private study: a student who tests themselves outside a circle.
It is the one shape that the product must allow without a teacher, and nullable
columns are cheaper than a second table for it.

**"What happens when a student becomes a teacher?"**
This is the real weakness of inheritance, and I would rather name it than avoid
it. It is a delete and a reinsert across two tables, not an `UPDATE`, because the
role `CHECK` on each child blocks a change of `role` in place.

You can keep the `user_id`, because the sequence is shared. But you must consider
the rows that reference `app.students`.

In this domain a role change is rare and an admin does it. We took that cost in
exchange for the structural role guarantee. A single-table design would make the
promotion trivial and the guarantee procedural. That is the trade.

**"Are the foreign-key columns indexed?"**
Only where an access path needs one. PostgreSQL does not index foreign-key
columns automatically. The partial unique indexes on `progress` start with
`student_id`, so they serve per-student lookups. The ones that I would add next
are `set_items(hadith_id)`, for "which sets contain this hadith", and
`assignments(circle_id)`. To index every foreign key by reflex costs write
throughput on the OLTP side, for scans that we never run.

---

## Part 4 — Question bank: the corpus (your partner's, but be ready)

**"Is `isnad_links` not just a bridge table? Why call it a weak entity?"**
It is both, and the weak-entity reading is the one that matters. It cannot exist
without its hadith, and its identity is *(hadith, sanad number, position)*. The
partial key is a position, not a pair of foreign keys. A pure bridge table would
be `(hadith, narrator)`, and it would lose the order, which in this domain is most
of the information.

**"Why not a narrator-taught-narrator self-relationship?"**
Because "A transmitted to B" is not a fact about A. It is a fact about A *inside
one specific chain*. The same narrator has different teachers in different
chains, so a self-reference cannot hold it. We store the paths and *derive* the
edges. `corpus.isnad_edges` is a view that joins position *n* to *n+1*. To store
both would be redundancy that invites drift.

**"A chain walk really should be a recursive CTE."**
Only if the graph were stored as edges with an unknown depth. The position is
stored, so a chain is a `GROUP BY` with an `ORDER BY`. That is plain aggregation.
To write `WITH RECURSIVE` over data that already knows its own order would be a
demonstration of recursion, not a design decision.

**"`narrator_id` is nullable in `isnad_links`. Does that not break referential integrity?"**
No. A NULL foreign key is unenforced by definition, and NULL here means
*unresolved*, which is a true statement about the source data.

The `resolution` column records how each row was resolved. `A` is a unique name
match. `B` is positional. `C` means that the name matched more than one narrator.
`X` means no match. We quote the rates instead of hiding them. The alternative was to
drop the unresolved links, which would shorten the chains in silence.

**"The numbers in `chain_strength` — 0.5, 0.15, and the 0.05 anʿana penalty — are arbitrary."**
They are a documented convention. We would defend the *shape*, not the constants.

Weakest link in each chain, and best chain wins, mirror how the classical method
reasons. A named but ungraded narrator gets a neutral 0.5, because ungraded is not
the same as criticised. An unnamed narrator gets 0.15, because *mubham* is a
recognised weakness. The constants are tunable in `rank_levels`.

The design goal was a metric that we can explain line by line, not one that claims
scholarly authority. The platform gives no rulings.

**"To store both `rank_ibn_hajar_raw` and `rank_ibn_hajar` is redundant."**
Neither one derives the other at read time. The raw string is what the source
says, and it is what we display, because to paraphrase a grade would be
dishonest. The code is a normalised handle that `rank_levels` does arithmetic on.

The map between them is many-to-one and lossy. It lives in `staging.rank_map`,
the ETL applies it one time, and it goes away with staging. It is never on a read
path.

**"Why keep the grades of two scholars instead of resolving them?"**
Because the disagreement is a finding, not noise. One of our analytics pages
ranks narrators by how far apart Ibn Hajar and al-Dhahabi are. Where the metric
must choose, it takes the weaker of the two, which is the conservative choice, and
we state that.

**"`hadiths.sanad_count` is derivable from `isnad_links`."**
It is. We keep it because the source provides it. It is the count from the
dataset itself, so it also checks that our flattening produced the right number of
chains. The positional resolution pass also keys off `sanad_count = 1`. It is fair
to call it a cache. It is a cache that also validates the load.

**"What normal form is the schema in?"**
3NF throughout, with two conscious exceptions that we can point at.

`app.student_stats` is a derived cache that a trigger maintains. And `narrators`
keeps some free-text source fields, `tabaqa_raw` and `school`, that a stricter
model would promote to dimensions. They arrive as uncontrolled text, and to invent
a vocabulary for them would fabricate precision.

`name_norm` is a stored generated column. It is functionally dependent on `name`
by construction, and we store it so that it can be indexed for matching.

---

## Part 5 — Question bank: the boundary and the whole design

**"Why two schemas instead of a prefix on the table names?"**
Because a schema is a unit that you can grant, and a prefix is a naming habit.
The whole argument depends on being able to say `GRANT SELECT ON ALL TABLES IN
SCHEMA corpus`. A prefix gives you nothing to grant.

**"Why not two separate databases, or two servers? Those workloads really are different."**
Because the foreign keys across the boundary are worth more than the
independence. `set_items.hadith_id` and `progress.hadith_id` really do reference
`corpus.hadiths`, and in one instance the database enforces that. Split them and
they become integers that you hope point somewhere.

At this scale that is the wrong trade. If corpus analytics ever became the
bottleneck, the answer is a read replica, not a split.

**"Does a foreign key from `app` into `corpus` not count as a write to the corpus?"**
No. To validate a foreign key is a read, plus a key-share lock on the referenced
row. It needs `SELECT` or `REFERENCES`, never `INSERT`, `UPDATE`, or `DELETE`. It
therefore sits comfortably inside the grant that we described.

**"What about `ON DELETE CASCADE` across the boundary?"**
There is none, and none is needed. Nothing deletes a corpus row at runtime,
because nothing at runtime holds delete on them. The `ON DELETE` question
disappears with the write privilege.

**"You show four crossings. What if a student wants to bookmark a *narrator*?"**
Then it is a fifth crossing with exactly the same shape: an app table with a
read-only foreign key into `corpus.narrators`. We did not model it because it is
not in the product. The point of the slide is that the interface is narrow and one
way, not that four is a magic number.

**"Where is the ETL? How did 14,901 hadiths get in?"**
We cut it from a six-slide talk deliberately, and I am happy to walk it.

Raw files are a lake, and we read the schema on use. Node streams them and does
*structural* flattening only, into flat typed staging tables. All semantic work —
dimension extraction, narrator resolution, grade normalisation, and the English
text — is SQL. Then the database sets the privileges and deletes `staging`, so
nobody can confuse the load-time machinery with a runtime capability.

**"Why does `staging` exist if you throw it away?"**
So that the messy work is inspectable while it happens, and gone afterwards. We
run the resolution and disagreement reports against staging before the deletion.
Nothing in the running system depends on it. That is the design, not an accident.

**"Who did which part?"**
Answer from `prd.md` §7 and be specific. A vague answer here reads as though one
person did the work. Then say the true thing: both of us can defend any line, and
that is why I answer corpus questions and my partner can answer study-layer ones.

---

## Part 6 — Do not say these

- **"It is read-only because we do not write to it."** That is the convention that
  you spent the slide arguing against. The role does not hold the privilege.
- **"Three schemas."** At runtime there are two. `staging` is gone before the app
  connects. The count of three includes it, and it is out of scope for this deck.
- **"That is a good question."** Answer it.
- **"I think"**, **"maybe"**, or **"we could have"** about a decision that is
  already made and documented. If it is in the DDL with a comment, it was a
  decision. Say so.
- Anything that you invent under pressure. A named gap and its fix scores better
  than a confident wrong answer, every time, and the panel can tell the
  difference.
- **"We ran out of time."** Say "out of scope for this deliverable", and name
  where it lands if that is true.

## If you do not know

> "I do not have that in front of me. It is in the DDL, and I would rather check
> than guess. My expectation is *X*, for reason *Y*."

That answer survives. A bluff does not. The follow-up question is always harder
than the first one.
