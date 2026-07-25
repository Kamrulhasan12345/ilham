---
marp: true
theme: ilham
paginate: true
lang: en
title: 'Ilham — Database Design'
description: 'Compact 6-slide presentation of the Ilham database design'
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Ilham <span class="ar">(إلهام)</span>

## A Teacher-Led Hadith Study Platform — Database Design

<div class="thesis">
One database, two opposite workloads,<br>
kept apart by <b>privilege</b> — not by convention.
</div>

<p class="byline">
2405045 &nbsp;·&nbsp; 2405052 &nbsp;·&nbsp; CSE216
</p>

<!--
20 seconds. Do not linger.

"Ilham is a platform where teachers assign classical hadith texts to students
and track their memorisation. The design problem is that it has to hold two
completely different kinds of data at once, and this is how we kept them apart."

Then move. Resist introducing yourselves at length.
-->

---

## The domain, and why it's a modelling problem

A **hadith** is a recorded narration. The **matn** is its text.

The **isnad** is the chain of people who transmitted it:

<div class="chain">
<span class="end">Companion</span><i>→</i><span>…</span><i>→</i><span>…</span><i>→</i><span class="end">Compiler</span>
</div>

Scholars grade those narrators — **and they disagree.**

Corpus: large, shared, never edited. Study activity: small, per-user, written
constantly. **Two opposite profiles, one database.**

<!--
60 seconds. The most compressed slide, and it makes the next three intelligible.

"Every hadith carries its own provenance — the chain isn't metadata about the
text, for this domain it's half the text. That's the reference side: large,
shared, and it never changes. Against it sits student activity: small, per-user,
written constantly. Two opposite profiles, one database."

Without isnad defined here, slide 3 is unreadable to a non-specialist.
-->

---

<!-- _class: corpus -->

## The corpus

<div class="diagram" style="--dw:72%">
<div>
<div class="callout corpus">
<b>A chain position is<br>a weak entity</b>
Identified by <i>(hadith, which chain, position)</i> — stored explicitly,
Companion first, compiler last.
</div>
</div>
<div class="fig"><img src="../erd/chen/corpus-sfdp.svg" alt="corpus ER diagram"></div>
</div>

<!--
80 seconds. The longest slide. This is where the marks are.

"Collections hold chapters hold hadiths — that part is ordinary. The interesting
entity is the double-bordered one: a chain position. It can't exist on its own;
it's identified by which hadith, which chain, and where in that chain.

The alternative was a 'this narrator taught that narrator' link, and it fails —
teacher-and-student isn't a fact about a narrator, it's a fact about a narrator
WITHIN ONE SPECIFIC CHAIN. Storing position explicitly makes chains first-class,
and it means walking a chain is plain aggregation rather than recursion."

If five seconds spare: "And note the two separate grading relationships — we
kept both scholars rather than collapsing them, because the disagreement is the
interesting part."

Do NOT enumerate attributes. Do NOT explain 0..1. One point.
-->

---

<!-- _class: app -->

## The study layer

<div class="diagram" style="--dw:62%">
<div>

<div class="callout app">
<b>Users specialise</b>
Disjoint: Student / Teacher / Admin. A foreign key to a <i>subtype</i> makes the
rule structural — an admin cannot own a circle.
</div>

<div class="callout app">
<b>Progress is grained per<br>(student, hadith, assignment)</b>
A hadith assigned twice is two obligations; prior self-study is never reset.
</div>

</div>
<div class="fig"><img src="../erd/chen/app-sfdp.svg" alt="app ER diagram"></div>
</div>

<!--
70 seconds.

"A teacher owns a circle, students enrol, the teacher assigns a study set, and
that produces progress rows — one per student per hadith.

Two decisions worth pointing at. Users specialise into three subtypes, so a
foreign key pointing at TEACHERS means an admin simply cannot own a circle — the
database enforces the rule with no application code. And progress is grained per
assignment, not per hadith, because the same hadith assigned twice is two
separate obligations."

Cut: inheritance trade-offs, trigger-maintained tables, partial indexes.
-->

---

<!-- _class: cross -->

## The boundary

<div class="diagram" style="--dw:56%">
<div>

Everything the study layer knows about the corpus is here.

**Four** relationships, all pointing at hadith — the entire interface between
the two halves.

<div class="revoke">
REVOKE INSERT, UPDATE, DELETE<br>
&nbsp;&nbsp;ON corpus.* FROM &lt;app role&gt;;
</div>

</div>
<div class="fig"><img src="../erd/chen/inter_layer-sfdp.svg" alt="inter-layer ER diagram"></div>
</div>

<!--
60 seconds. This slide IS the thesis; everything before was setup.

"This is everything the study layer knows about the corpus. Four relationships,
all pointing at hadith — a set contains them, progress tracks them, a review
tests them, a note is about one. That's the whole interface.

And because it's that narrow, we could revoke write privileges on the corpus
entirely. The distinction I want to leave you with is between a convention and a
guarantee: a comment saying 'don't write here' is a convention; a revoked
privilege is a guarantee. Nothing in the corpus even knows the application
exists."
-->

---

## It's a real schema — and what it guarantees

<div class="thumbs">
<figure>
<img src="../erd/relational/corpus.svg" alt="corpus tables">
<figcaption>corpus — 7 tables + 1 view</figcaption>
</figure>
<figure>
<img src="../erd/relational/app.svg" alt="app tables">
<figcaption>app — 15 tables</figcaption>
</figure>
</div>

<div class="claims">
<div><b>Chains are first-class</b>Stored positions, so traversal is aggregation — not recursion.</div>
<div><b>Disagreement preserved</b>Both scholars' grades kept, never collapsed into one number.</div>
<div><b>Corpus is read-only</b>Enforced by privilege — no application bug can undo it.</div>
</div>

<!--
50 seconds. Evidence plus close.

"Those conceptual models are implemented — every entity is a table, every
relationship a foreign key, and I'm showing these only to make the point that
the design exists as DDL rather than as a drawing.

To close: chains are stored positionally so they're queryable without recursion,
we kept both scholars' grades because the disagreement is the finding, and the
corpus is read-only in a way no application bug can undo. Happy to go deeper on
any of it."

Do NOT invite the audience to read the thumbnails. If someone asks, that's a
good question to get — open the full SVG.
-->
