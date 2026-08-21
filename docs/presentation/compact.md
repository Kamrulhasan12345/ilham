---
marp: true
theme: ilham
paginate: true
lang: en
title: "Ilham — Database Design"
description: "Compact 6-slide presentation of the Ilham database design"
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
20 seconds. Do not stop here.

"Ilham is a platform. Teachers assign classical hadith texts to students, and the
system tracks what the students learn. The design problem is that it must hold
two very different kinds of data at the same time. This talk shows how we kept
them apart."

Then move on. Do not introduce yourselves at length.
-->

---

## The domain, and why it is a modelling problem

A **hadith** is a recorded narration. The **matn** is its text.

The **isnad** is the chain of persons who transmitted it:

<div class="chain">
<span class="end">Companion</span><i>→</i><span>…</span><i>→</i><span>…</span><i>→</i><span class="end">Compiler</span>
</div>

Scholars grade those narrators — **and they disagree.**

Corpus: large, shared, never edited. Study activity: small, one user at a time,
written constantly. **Two opposite profiles, one database.**

<!--
60 seconds. This is the most compressed slide. It makes the next three
understandable.

"Every hadith carries its own provenance. The chain is not metadata about the
text. In this domain it is half of the text. That is the reference side: large,
shared, and it never changes. Against it sits the student activity: small, one
user at a time, and written constantly. Two opposite profiles, one database."

Define the isnad here. Without it, a non-specialist cannot read slide 3.
-->

---

<!-- _class: corpus figure-slide -->

## The corpus

<div class="fig-only"><img src="../erd/chen/corpus-sfdp.svg" alt="corpus ER diagram"></div>

<!--
80 seconds. The longest slide. The marks are here.

The slide is the diagram. Speak the weak-entity point; do not print it. Point at
the box with the double border while you say it.

"Collections hold chapters, and chapters hold hadiths. That part is ordinary. The
interesting entity is the one with the double border: a chain position. It cannot
exist on its own. Three things identify it: which hadith, which chain, and where
in that chain.

The alternative was a link that says 'this narrator taught that narrator', and it
fails. Teacher and student is not a fact about a narrator. It is a fact about a
narrator INSIDE ONE SPECIFIC CHAIN. To store the position explicitly makes chains
first-class. It also makes a chain walk plain aggregation instead of recursion."

If you have five seconds: "Note the two separate grading relationships. We kept
both scholars instead of one combined value, because the disagreement is the
interesting part."

Do NOT list the attributes. Do NOT explain the arrowheads. Make one point.
-->

---

<!-- _class: app figure-slide -->

## The study layer

<div class="fig-only"><img src="../erd/chen/app-sfdp.svg" alt="app ER diagram"></div>

<!--
70 seconds. Two spoken points. Point at both on the diagram: the ISA triangle
under User, and the grain of Progress.

"A teacher owns a circle. Students enrol. The teacher assigns a study set, and
that makes the progress rows: one row for each student and each hadith.

Two decisions are worth a look. First, users specialise into three subtypes. A
foreign key that points at TEACHERS therefore makes it impossible for an admin to
own a circle. The database enforces the rule, and it needs no application code.

Second, progress is grained for each assignment, not for each hadith. The same
hadith assigned two times is two separate obligations."

Cut these: the trade-offs of inheritance, the trigger-maintained tables, and the
partial indexes.
-->

---

<!-- _class: cross figure-slide -->

## The boundary

<div class="fig-only"><img src="../erd/chen/inter_layer-sfdp.svg" alt="inter-layer ER diagram"></div>

<!--
60 seconds. This slide IS the thesis. Everything before it was preparation.

The REVOKE is not printed. Say it, and say it slowly:
    REVOKE INSERT, UPDATE, DELETE ON corpus.* FROM <app role>;

"This is everything that the study layer knows about the corpus. Four
relationships, and all four point at the hadith. A set contains them, progress
tracks them, a review tests them, and a note is about one. That is the whole
interface.

Because the interface is that narrow, we could remove write privileges on the
corpus completely. I want to leave you with one distinction: a convention against
a guarantee. A comment that says 'do not write here' is a convention. A revoked
privilege is a guarantee. Nothing in the corpus even knows that the application
exists."
-->

---

## It is a real schema — and here is what it guarantees

<div class="thumbs">
<figure>
<img src="../erd/relational/corpus.svg" alt="corpus tables">
<figcaption>corpus — 8 tables + 1 view</figcaption>
</figure>
<figure>
<img src="../erd/relational/app.svg" alt="app tables">
<figcaption>app — 15 tables</figcaption>
</figure>
</div>

<div class="claims">
<div><b>Chains are first-class</b>The positions are stored, so a chain walk is aggregation — not recursion.</div>
<div><b>Disagreement is kept</b>Both scholars' grades stay. We never reduce them to one number.</div>
<div><b>The corpus is read-only</b>A privilege enforces it. No application bug can undo it.</div>
</div>

<!--
50 seconds. Evidence, then close.

"Those conceptual models are implemented. Every entity is a table and every
relationship is a foreign key. I show these only to make one point: the design
exists as DDL, not as a drawing.

To close. The chains are stored by position, so you can query them without
recursion. We kept the grades of both scholars, because the disagreement is the
finding. And the corpus is read-only in a way that no application bug can undo. I
am happy to go deeper on any part of it."

Do NOT ask the audience to read the thumbnails. If somebody asks about one, that
is a good question. Open the full SVG.
-->
