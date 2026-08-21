-- =============================================================================
-- ILHAM — curated rijal grade map.  staging.rank_map
--
-- Reviewed by hand from the frequency worklist that `node src/cli.js rankmap`
-- writes to build/rank_map.sql. Committed because every row is a judgement
-- call and the report has to defend them line by line (req 9).
--
-- codes: thiqa(6) saduq(5) maqbul(4) layyin(3) daif(2) matruk(1)
--
-- Two kinds, applied in this order by sql/13_ranks.sql:
--   exact  pass 1  whole normalised string. Exceptions to the token rules.
--   token  pass 2  first word of the normalised string. Where the coverage is.
--
-- raw_string is the PRIMARY KEY, so a given string is either a token rule or an
-- exact rule, never both. Single-word grades are therefore token rules.
--
-- WHAT IS DELIBERATELY ABSENT. These are frequent FIRST TOKENS that are not
-- verdicts, and a token rule on them would assign grades arbitrarily:
--
--   قال    (562)  "he said..." — the verdict is inside the quotation
--   لا     (253)  begins 'لا بأس به' (saduq) AND 'لا يعرف' (unknown) — opposite
--   له     (233)  begins 'له صحبة' (Companion) AND 'له أوهام' (errs)
--   فيه    ( 75)  begins 'فيه لين' AND 'فيه ضعف'
--   من     ( 94)  'من كبار الصحابة', 'من الثقات', ...
--   مختلف  ( 81)  'مختلف فيه' — contested, by definition not one verdict
--   احد    ( 79)  'أحد العشرة', 'أحد الأعلام'
--   كان    ( 67)  'كان ثبتا', 'كان يخطئ'
--   ليس           'ليس بالقوي' (layyin) AND 'ليس بثقة' (daif)
--
-- Their common full forms are picked up as exact rules below where the meaning
-- is unambiguous. Everything else stays unmapped and scores the neutral 0.50 —
-- which is correct: no verdict was expressed, and inventing one would be worse
-- than admitting it.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE staging.rank_map;

-- -----------------------------------------------------------------------------
-- EXACT rules (pass 1). Applied first, so they override the token rules.
-- Multi-word phrases whose verdict differs from what their first token implies.
-- -----------------------------------------------------------------------------
INSERT INTO staging.rank_map (raw_string, rank_code, match_kind) VALUES
  ('لا باس به',   'saduq',  'exact'),   -- 'no harm in him' — Ibn Hajar's saduq band
  ('له صحبه',     'thiqa',  'exact'),   -- 'he has companionship' — a Companion
  ('لا يعرف',     'daif',   'exact'),   -- 'he is not known' — jahala
  ('فيه لين',     'layyin', 'exact'),   -- 'there is softness in him'
  ('فيه ضعف',     'daif',   'exact'),   -- 'there is weakness in him'
  ('ليس بالقوي',  'layyin', 'exact'),   -- 'not strong' — criticism short of daif
  ('ليس بثقه',    'daif',   'exact'),   -- 'not trustworthy'
  ('لا يحتج به',  'daif',   'exact'),   -- 'not used as proof'
  ('مجهول الحال', 'daif',   'exact'),   -- majhul al-hal, explicitly unknown
  ('من كبار الصحابه', 'thiqa', 'exact')
ON CONFLICT (raw_string) DO UPDATE
  SET rank_code = EXCLUDED.rank_code, match_kind = EXCLUDED.match_kind;

-- -----------------------------------------------------------------------------
-- TOKEN rules (pass 2). The grade word leads; qualification follows. One rule
-- covers every compound built on it: 'ثقة', 'ثقة حافظ', 'ثقة ثبت لكنه تغير'
-- all resolve through the single 'ثقه' rule.
-- -----------------------------------------------------------------------------
INSERT INTO staging.rank_map (raw_string, rank_code, match_kind) VALUES
  -- trustworthy
  ('ثقه',     'thiqa',  'token'),   -- 3566
  ('وثق',     'thiqa',  'token'),   --  733  'was declared reliable' (passive)
  ('وثقه',    'thiqa',  'token'),   --  406  'X declared him reliable'
  ('وثقوه',   'thiqa',  'token'),   --   69  'they declared him reliable'
  ('الحافظ',  'thiqa',  'token'),   --  114  al-Dhahabi's honorific for the top tier
  ('حافظ',    'thiqa',  'token'),
  ('ثبت',     'thiqa',  'token'),
  ('امام',    'thiqa',  'token'),
  ('الامام',  'thiqa',  'token'),
  ('مخضرم',   'thiqa',  'token'),   -- lived through both eras; not itself a grade,
                                    -- but the entries carrying it are uniformly
                                    -- praise ('مخضرم ، ثقة ، مكثر ، فقيه')

  -- Companions. The generation, not a verdict — الصحابة كلهم عدول. Kept here as
  -- well as in the tabaqa rule because the string also appears in the rank
  -- fields, and pass 2 runs before pass 3.
  ('صحابي',   'thiqa',  'token'),   --  782
  ('صحابيه',  'thiqa',  'token'),   --  135  feminine
  ('الصحابي', 'thiqa',  'token'),

  -- truthful, minor slips
  ('صدوق',    'saduq',  'token'),   -- 2189
  ('شيخ',     'saduq',  'token'),   --   30  al-Dhahabi's middling term
  ('صالح',    'saduq',  'token'),   --       'صالح الحديث'

  -- acceptable when corroborated
  ('مقبول',   'maqbul', 'token'),   -- 1533  Ibn Hajar's Taqrib vocabulary
  ('مقبوله',  'maqbul', 'token'),   --   64  feminine

  -- soft
  ('لين',     'layyin', 'token'),   --  146
  ('مستور',   'layyin', 'token'),   --  155  identity known, reliability not

  -- weak
  ('ضعيف',    'daif',   'token'),   --  427
  ('ضعفوه',   'daif',   'token'),   --   94  'they weakened him'
  ('ضعفه',    'daif',   'token'),   --   86  'X weakened him'
  ('ضعف',     'daif',   'token'),   --   42
  ('واه',     'daif',   'token'),   --   49  'feeble'
  -- jahala is a stated DEFECT, not an absence of information. This is the one
  -- place the map moves a narrator below neutral on the strength of a single
  -- word, and it is deliberate: 'مجهول' is the sources declaring the man
  -- unidentifiable, which is exactly what weakens a chain.
  ('مجهول',   'daif',   'token'),   --  812

  -- abandoned
  ('متروك',   'matruk', 'token'),   --  145
  ('تركوه',   'matruk', 'token'),   --   24  'they abandoned him'
  ('كذاب',    'matruk', 'token'),
  ('وضاع',    'matruk', 'token'),
  ('متهم',    'matruk', 'token')
ON CONFLICT (raw_string) DO UPDATE
  SET rank_code = EXCLUDED.rank_code, match_kind = EXCLUDED.match_kind;

COMMIT;

\echo 'rank_map loaded'
