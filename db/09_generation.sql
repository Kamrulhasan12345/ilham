-- =============================================================================
-- 09_generation.sql — tabaqa ordinals for arithmetic.
--
-- The corpus records a narrator's generation as free Arabic text
-- (narrators.tabaqa_raw): ordinals like 'الثالثة', seniority prefixes like
-- 'كبار العاشرة' / 'من صغار التاسعة', and Companion forms like 'صحابي'.
-- A slider cannot filter on free text, and parsing Arabic ordinals at read
-- time in every client would fork the mapping. So the mapping lives here,
-- once, beside staging.rank_map's own load-time precedent: raw strings for
-- display, small integers for arithmetic, NULL where the text names no
-- generation.
--
-- Two rule tiers over corpus.normalize_arabic's output (diacritics gone,
-- ة→ه, حمزة carriers unified, edge punctuation dropped):
--
-- 1. An ordinal word anywhere in the text wins, longest first: 'من كبار
--    السابعة' and 'الثانية ، مخضرم' both name their tabaqa outright, and
--    كبار/صغار qualify within a tabaqa rather than moving it.
-- 2. Else a Companion-claim marker (صحب, رؤية, بدر, الفتح, الصفة, وفادة,
--    أحد العشرة) maps to 1, the PRD's own Companion generation — even
--    'مختلف في صحبته', which claims that generation while disputing it.
--
-- What stays NULL is honest: bare 'مخضرم', 'من كبار التابعين', or a
-- biographical note ('ذكره ابن حبان في ثقات التابعين') names no tabaqa,
-- so no number is invented for it. The frontend filter always shows such
-- links and says so in its readout.
--
-- Run as the database owner (like 08_search.sql), then regenerate
-- db/ilham.dump so a fresh clone carries the column.
-- =============================================================================

CREATE OR REPLACE FUNCTION corpus.tabaqa_generation(raw text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN norm LIKE '%الثانيه عشره%' THEN 12
    WHEN norm LIKE '%الحاديه عشره%' THEN 11
    WHEN norm LIKE '%العاشره%' THEN 10
    WHEN norm LIKE '%التاسعه%' THEN 9
    WHEN norm LIKE '%الثامنه%' THEN 8
    WHEN norm LIKE '%السابعه%' THEN 7
    WHEN norm LIKE '%السادسه%' THEN 6
    WHEN norm LIKE '%الخامسه%' THEN 5
    WHEN norm LIKE '%الرابعه%' THEN 4
    WHEN norm LIKE '%الثالثه%' THEN 3
    WHEN norm LIKE '%الثانيه%' THEN 2
    WHEN norm LIKE '%صحاب%' OR norm LIKE '%صحب%'
      OR norm LIKE '%روي%' OR norm LIKE '%بدر%'
      OR norm LIKE '%العشره%' OR norm LIKE '%الفتح%'
      OR norm LIKE '%الصفه%' OR norm LIKE '%وفاد%'
      OR norm LIKE '%شهد%' OR norm LIKE '%سبط%'
      OR norm LIKE '%المهاجر%' OR norm LIKE '%شاعر%'
      OR norm LIKE '%خليفه%' OR norm LIKE '%ام المومنين%'
      OR norm LIKE '%السابق%' OR norm LIKE '%النقبا%' THEN 1
    ELSE NULL
  END
  FROM (SELECT corpus.normalize_arabic(raw) AS norm) n
$$;

COMMENT ON FUNCTION corpus.tabaqa_generation(text) IS
'Free-text tabaqa to generation ordinal. Raw strings stay for display; this integer is for arithmetic only.';

ALTER TABLE corpus.narrators DROP COLUMN IF EXISTS generation;

ALTER TABLE corpus.narrators
  ADD COLUMN generation integer
  GENERATED ALWAYS AS (corpus.tabaqa_generation(tabaqa_raw)) STORED;

COMMENT ON COLUMN corpus.narrators.generation IS
'Generation ordinal derived from tabaqa_raw. NULL where the text names no generation.';
