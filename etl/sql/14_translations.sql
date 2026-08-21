-- =============================================================================
-- ILHAM ETL — 14_translations.sql
--
-- OPTIONAL feeder. corpus.hadith_translations stands with or without it; the
-- hadith detail page falls back to Arabic where no translation exists.
-- Safe to run against an empty staging.lk_hadiths — it inserts nothing.
-- Nothing downstream depends on this stage.
--
-- -----------------------------------------------------------------------------
-- WHY THIS DOES NOT JOIN ON hadith_num
-- -----------------------------------------------------------------------------
-- LK-Hadith-Corpus and the Ifta dataset number their hadiths on different
-- systems. LK numbers Sahih Muslim 1..7314 straight through; Ifta uses the
-- traditional grouped numbering, 1..3033, and splits each numbered group into
-- one record per narration. The two never line up.
--
-- Measured on the loaded corpus, over pairs that match on TEXT and are
-- therefore known to be the same hadith:
--
--     Sahih Muslim        6,755 of 6,758 pairs carry a DIFFERENT number  (100.0%)
--     Sahih al-Bukhari    2,117 of 6,595 pairs carry a DIFFERENT number  ( 32.1%)
--
-- A number join does not merely miss rows. It attaches the English of one
-- hadith to a different hadith, and both texts look plausible, so nothing
-- downstream can detect it. That is the one failure this schema refuses
-- everywhere else, so it is refused here too.
--
-- -----------------------------------------------------------------------------
-- WHAT IT JOINS ON INSTEAD
-- -----------------------------------------------------------------------------
-- Normalised Arabic text. LK carries Arabic_Hadith alongside its English, so
-- both sides hold the same hadith in the same language and the match needs no
-- identifier at all.
--
-- Two systematic differences between the editions are removed first:
--
--   1. Ifta prepends the باب chapter heading to text_plain (4,462 hadiths),
--      sometimes with a Qur'anic preamble that is not in chapters.title_ar.
--      staging.anchor() cuts both sides at the first narration verb, which
--      removes Ifta's preamble and leaves LK unchanged.
--   2. The tails diverge — the same hadith ends differently between editions
--      (#2: 365 letters in Ifta, 279 in LK, identical up to that point). So the
--      lower tiers compare a PREFIX, not the whole string.
--
-- Five tiers run in order, each seeing only what the previous left unmatched,
-- so a strong match always beats a weak one. corpus.hadith_translations.match_via
-- records which tier won — the same honesty as isnad_links.resolution.
--
--   E  full anchored text identical
--   P  first 100 letters identical, one-to-one
--   6  first  60 letters identical, one-to-one
--   4  first  40 letters identical, one-to-one
--   M  matn identical, one-to-one  (catches editions whose isnad wording differs)
--
-- Tier E allows several hadiths to take one LK row: if their Arabic is
-- byte-identical after normalisation they are the same text, so one English is
-- correct for all of them — but only when every candidate LK row carries the
-- same English. The prefix tiers do NOT allow this. A shared opening with a
-- different ending is a different hadith, so those require a strict one-to-one
-- pairing on both sides and are otherwise left unmatched.
--
-- NOTHING IS DELETED. A hadith with no acceptable match keeps its Arabic and
-- simply has no translation row. Coverage is a property of LK, not of the
-- corpus: LK ships 7,314 rows for Muslim's 7,626 hadiths, so at least 312 of
-- them can never have an English text from this source.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE corpus.hadith_translations;
DELETE FROM staging.rejects WHERE stage = '14_translations';

-- -----------------------------------------------------------------------------
-- Match keys. Materialised rather than computed inline: each side is keyed four
-- ways and the tiers re-read them, so computing once is the difference between
-- seconds and minutes.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE t_ifta ON COMMIT DROP AS
SELECT h.hadith_id,
       c.slug AS book_slug,
       h.hadith_num,
       -- Strip the chapter heading when text_plain opens with it, THEN anchor.
       -- The heading is stripped first because anchoring alone leaves headings
       -- that themselves contain a narration verb.
       staging.anchor(
           CASE WHEN staging.match_key(ch.title_ar) <> ''
                 AND staging.match_key(h.text_plain)
                     LIKE staging.match_key(ch.title_ar) || '%'
                THEN substr(staging.match_key(h.text_plain),
                            length(staging.match_key(ch.title_ar)) + 1)
                ELSE staging.match_key(h.text_plain) END) AS a,
       staging.match_key(h.matn_plain) AS m
FROM corpus.hadiths h
JOIN corpus.collections c USING (collection_id)
JOIN corpus.chapters ch ON ch.chapter_id = h.chapter_id;

ALTER TABLE t_ifta ADD COLUMN alen int, ADD COLUMN mlen int, ADD COLUMN hf text,
                   ADD COLUMN p100 text, ADD COLUMN p60 text, ADD COLUMN p40 text,
                   ADD COLUMN hm text;
UPDATE t_ifta SET alen = length(a), mlen = length(m), hf = md5(a), hm = md5(m),
                  p100 = left(a,100), p60 = left(a,60), p40 = left(a,40);

CREATE TEMP TABLE t_lk ON COMMIT DROP AS
SELECT lk.lk_row_id,
       lk.book_slug,
       lk.hadith_num,
       lk.text_en,
       staging.anchor(staging.match_key(lk.arabic_text)) AS a,
       md5(lk.text_en) AS he
FROM staging.lk_hadiths lk;

ALTER TABLE t_lk ADD COLUMN alen int, ADD COLUMN hf text,
                 ADD COLUMN p100 text, ADD COLUMN p60 text, ADD COLUMN p40 text;
UPDATE t_lk SET alen = length(a), hf = md5(a),
                p100 = left(a,100), p60 = left(a,60), p40 = left(a,40);

-- Tier M compares matn to matn. LK leaves Arabic_Matn empty on 530 rows; those
-- simply do not take part in tier M. There is no fallback to the full text — an
-- Ifta matn is the saying alone, an LK full text includes the isnad, so the two
-- could only ever match by accident.
CREATE TEMP TABLE t_lkm ON COMMIT DROP AS
SELECT lk.lk_row_id, lk.book_slug,
       md5(staging.match_key(lk.arabic_matn)) AS hm,
       length(staging.match_key(lk.arabic_matn)) AS mlen
FROM staging.lk_hadiths lk
WHERE lk.arabic_matn IS NOT NULL;

CREATE INDEX ON t_ifta (book_slug, hf);   CREATE INDEX ON t_ifta (book_slug, p100);
CREATE INDEX ON t_ifta (book_slug, p60);  CREATE INDEX ON t_ifta (book_slug, p40);
CREATE INDEX ON t_ifta (book_slug, hm);
CREATE INDEX ON t_lk   (book_slug, hf);   CREATE INDEX ON t_lk   (book_slug, p100);
CREATE INDEX ON t_lk   (book_slug, p60);  CREATE INDEX ON t_lk   (book_slug, p40);
CREATE INDEX ON t_lkm  (book_slug, hm);
ANALYZE t_ifta; ANALYZE t_lk; ANALYZE t_lkm;

CREATE TEMP TABLE t_match (
    hadith_id int PRIMARY KEY,
    lk_row_id int NOT NULL,
    book_slug text NOT NULL,
    via       char(1) NOT NULL
) ON COMMIT DROP;

-- --- Tier E: full anchored text identical ------------------------------------
-- Several hadiths may share one LK row here, and that is correct: identical
-- Arabic means identical meaning. Guarded by count(DISTINCT he) = 1 so it only
-- fires when every candidate row would have supplied the same English anyway.
INSERT INTO t_match (hadith_id, lk_row_id, book_slug, via)
SELECT i.hadith_id, min(l.lk_row_id), i.book_slug, 'E'
FROM t_ifta i JOIN t_lk l ON l.book_slug = i.book_slug AND l.hf = i.hf
WHERE i.alen > 0
GROUP BY i.hadith_id, i.book_slug
HAVING count(DISTINCT l.he) = 1;

-- --- Tiers P / 6 / 4: prefix, strict one-to-one -------------------------------
-- Repeated three times at falling thresholds rather than written as a loop:
-- each pass must see the rows the previous one claimed, and the whole point of
-- the ladder is that it is auditable pass by pass in the report.
INSERT INTO t_match (hadith_id, lk_row_id, book_slug, via)
WITH p AS (
  SELECT i.hadith_id, i.book_slug, l.lk_row_id
  FROM t_ifta i JOIN t_lk l ON l.book_slug = i.book_slug AND l.p100 = i.p100
  WHERE i.alen >= 100 AND l.alen >= 100
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.hadith_id = i.hadith_id)
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.lk_row_id = l.lk_row_id)),
ic AS (SELECT hadith_id, count(*) n FROM p GROUP BY 1),
lc AS (SELECT lk_row_id, count(*) n FROM p GROUP BY 1)
SELECT p.hadith_id, p.lk_row_id, p.book_slug, 'P'
FROM p JOIN ic ON ic.hadith_id = p.hadith_id
       JOIN lc ON lc.lk_row_id = p.lk_row_id
WHERE ic.n = 1 AND lc.n = 1;

INSERT INTO t_match (hadith_id, lk_row_id, book_slug, via)
WITH p AS (
  SELECT i.hadith_id, i.book_slug, l.lk_row_id
  FROM t_ifta i JOIN t_lk l ON l.book_slug = i.book_slug AND l.p60 = i.p60
  WHERE i.alen >= 60 AND l.alen >= 60
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.hadith_id = i.hadith_id)
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.lk_row_id = l.lk_row_id)),
ic AS (SELECT hadith_id, count(*) n FROM p GROUP BY 1),
lc AS (SELECT lk_row_id, count(*) n FROM p GROUP BY 1)
SELECT p.hadith_id, p.lk_row_id, p.book_slug, '6'
FROM p JOIN ic ON ic.hadith_id = p.hadith_id
       JOIN lc ON lc.lk_row_id = p.lk_row_id
WHERE ic.n = 1 AND lc.n = 1;

INSERT INTO t_match (hadith_id, lk_row_id, book_slug, via)
WITH p AS (
  SELECT i.hadith_id, i.book_slug, l.lk_row_id
  FROM t_ifta i JOIN t_lk l ON l.book_slug = i.book_slug AND l.p40 = i.p40
  WHERE i.alen >= 40 AND l.alen >= 40
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.hadith_id = i.hadith_id)
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.lk_row_id = l.lk_row_id)),
ic AS (SELECT hadith_id, count(*) n FROM p GROUP BY 1),
lc AS (SELECT lk_row_id, count(*) n FROM p GROUP BY 1)
SELECT p.hadith_id, p.lk_row_id, p.book_slug, '4'
FROM p JOIN ic ON ic.hadith_id = p.hadith_id
       JOIN lc ON lc.lk_row_id = p.lk_row_id
WHERE ic.n = 1 AND lc.n = 1;

-- --- Tier M: matn identical, strict one-to-one --------------------------------
-- The last resort, for pairs whose isnad wording differs between editions but
-- whose saying is word-for-word the same. 40-letter floor: a short matn is a
-- formula ("عن النبي صلى الله عليه وسلم") shared by hundreds of hadiths.
INSERT INTO t_match (hadith_id, lk_row_id, book_slug, via)
WITH p AS (
  SELECT i.hadith_id, i.book_slug, l.lk_row_id
  FROM t_ifta i JOIN t_lkm l ON l.book_slug = i.book_slug AND l.hm = i.hm
  WHERE i.mlen >= 40 AND l.mlen >= 40
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.hadith_id = i.hadith_id)
    AND NOT EXISTS (SELECT 1 FROM t_match m WHERE m.lk_row_id = l.lk_row_id)),
ic AS (SELECT hadith_id, count(*) n FROM p GROUP BY 1),
lc AS (SELECT lk_row_id, count(*) n FROM p GROUP BY 1)
SELECT p.hadith_id, p.lk_row_id, p.book_slug, 'M'
FROM p JOIN ic ON ic.hadith_id = p.hadith_id
       JOIN lc ON lc.lk_row_id = p.lk_row_id
WHERE ic.n = 1 AND lc.n = 1;

-- -----------------------------------------------------------------------------
-- Publish
-- -----------------------------------------------------------------------------
INSERT INTO corpus.hadith_translations (hadith_id, lang, text_full, source, match_via)
SELECT m.hadith_id, 'en', l.text_en, 'LK', m.via
FROM t_match m JOIN t_lk l ON l.lk_row_id = m.lk_row_id
ON CONFLICT (hadith_id, lang) DO NOTHING;   -- first source wins

-- -----------------------------------------------------------------------------
-- Rejects — nothing is dropped silently.
-- -----------------------------------------------------------------------------

-- LK rows no hadith claimed. Expected: LK and Ifta disagree on what counts as
-- one hadith, so some LK rows have no counterpart at all.
INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '14_translations', 'lk_row_unmatched',
       l.book_slug || '#' || coalesce(l.hadith_num, '?'), left(l.text_en, 120)
FROM t_lk l
WHERE NOT EXISTS (SELECT 1 FROM t_match m WHERE m.lk_row_id = l.lk_row_id);

-- Hadiths left without English. NOT a failure and NOT a deletion: the hadith
-- keeps its Arabic. Recorded so the coverage figure can be audited per book.
INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '14_translations', 'hadith_untranslated',
       i.book_slug || '#' || i.hadith_num, left(i.a, 120)
FROM t_ifta i
WHERE NOT EXISTS (SELECT 1 FROM t_match m WHERE m.hadith_id = i.hadith_id);

-- -----------------------------------------------------------------------------
-- Metrics
-- -----------------------------------------------------------------------------
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '14_translations', 'translations_loaded', NULL,
       (SELECT count(*) FROM corpus.hadith_translations)
UNION ALL
SELECT '14_translations', 'lk_rows_staged', NULL, (SELECT count(*) FROM staging.lk_hadiths)
UNION ALL
SELECT '14_translations', 'lk_rows_unmatched', NULL,
       (SELECT count(*) FROM staging.rejects
        WHERE stage='14_translations' AND reason='lk_row_unmatched')
UNION ALL
SELECT '14_translations', 'hadiths_untranslated', NULL,
       (SELECT count(*) FROM staging.rejects
        WHERE stage='14_translations' AND reason='hadith_untranslated')
UNION ALL
SELECT '14_translations', 'pct_hadiths_translated', NULL,
       round(100.0 * (SELECT count(*) FROM corpus.hadith_translations)
             / nullif((SELECT count(*) FROM corpus.hadiths), 0), 2);

-- Per-book coverage. Bukhari and Muslim differ enough that one global figure
-- hides the story.
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '14_translations', 'pct_translated', c.slug,
       round(100.0 * count(t.hadith_id) / nullif(count(*), 0), 2)
FROM corpus.hadiths h
JOIN corpus.collections c USING (collection_id)
LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = 'en'
GROUP BY c.slug;

-- Tier breakdown: how much of the coverage rests on the weaker matches.
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '14_translations', 'match_via_' || match_via, NULL, count(*)
FROM corpus.hadith_translations GROUP BY match_via;

-- The evidence for not joining on hadith_num: among pairs we matched on text,
-- and therefore know to be the same hadith, how often do the two numberings
-- disagree? Snapshotted because staging is about to be dropped and this is the
-- number the report cites.
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '14_translations', 'pct_num_disagreement', m.book_slug,
       round(100.0 * count(*) FILTER (WHERE i.hadith_num IS DISTINCT FROM l.hadith_num)
             / nullif(count(*), 0), 2)
FROM t_match m
JOIN t_ifta i ON i.hadith_id = m.hadith_id
JOIN t_lk   l ON l.lk_row_id = m.lk_row_id
GROUP BY m.book_slug;

COMMIT;

\echo '14_translations done'
