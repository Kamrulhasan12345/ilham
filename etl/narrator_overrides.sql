-- =============================================================================
-- ILHAM — per-narrator grade overrides.  staging.narrator_rank_override
-- Applied by sql/13_ranks.sql pass 4, unconditionally (they outrank inference).
--
-- WHY THIS FILE EXISTS
--
-- The rijal literature does not grade the giants. Grading presupposes doubt,
-- and for the most eminent transmitters there is none to express, so the entry
-- carries ENCOMIUM instead of a verdict:
--
--   al-Zuhri     'الفقيه الحافظ ، متفق على جلالته وإتقانه وثبته'
--   Malik        'الفقيه ، إمام دار الهجرة ، رأس المتقنين'
--   Abu Hurayra  'الصحابي الجليل ، حافظ الصحابة'
--
-- None of that parses as a grade, so passes 1-3 leave them NULL and
-- chain_strength scores them the neutral 0.50. Because chain_strength is
-- weakest-link, ONE such narrator caps the entire sanad — and these are the
-- highest-traffic narrators in the corpus (al-Zuhri appears in 2,209 chain
-- positions across Bukhari and Muslim, Abu Hurayra 2,336). Left alone, the
-- metric scores the strongest isnads in the collection lowest. That is an
-- inversion, not a coverage gap, which is why these ten rows are worth more
-- than a thousand tail entries in rank_map.
--
-- Most Companions are already caught by pass 3 (tabaqa says صحابي / أم المؤمنين
-- / أحد العشرة / صحبة). Listed here are the ones that rule cannot reach: the
-- non-Companion giants, and the Companions whose tabaqa is phrased unusually.
--
-- Every row carries its justification. These are assertions about named people
-- and each must stand on its own in the report.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE staging.narrator_rank_override;

INSERT INTO staging.narrator_rank_override (narrator_id, scholar, rank_code, note) VALUES
  (5917, 'ibn_hajar', 'thiqa',
   'al-Zuhri (Muhammad b. Muslim b. Shihab). Entry is praise, not a grade: '
   '"agreed upon as to his eminence, precision and reliability". 2209 chain positions.'),
  (5917, 'dhahabi', 'thiqa',
   'al-Zuhri. al-Dhahabi likewise records eminence rather than a verdict.'),

  (5361, 'ibn_hajar', 'thiqa',
   'Malik b. Anas. "Imam of the Abode of Emigration, chief of the precise" — '
   'the eponym of a madhhab is not graded. 1033 chain positions.'),
  (5361, 'dhahabi', 'thiqa',
   'Malik b. Anas. Same reasoning.'),

  (2436, 'ibn_hajar', 'thiqa',
   'Sa''id b. al-Musayyib. "One of the firm scholars, the great jurists" — '
   'foremost of the seven fuqaha of Madina. 381 chain positions.'),

  (2249, 'ibn_hajar', 'thiqa',
   'Salim b. Abd Allah b. Umar. "He was firm, devout, excellent" — praise in '
   'place of a grade. 313 chain positions.'),

  (710, 'ibn_hajar', 'thiqa',
   'al-Aswad b. Yazid al-Nakha''i. Entry reads "mukhadram, thiqa, prolific, '
   'jurist" — the grade is present but not in first position. 158 positions.'),

  (1219, 'ibn_hajar', 'thiqa',
   'Abu Qatada al-Ansari. A Companion, but his tabaqa is phrased "witnessed '
   'Uhud and what followed", which the pass-3 pattern does not match.'),

  (5495, 'ibn_hajar', 'thiqa',
   'al-Bukhari. "The mountain of memorisation, imam of the world in hadith '
   'jurisprudence". Excluded from chain_strength as compiler, but graded for '
   'completeness — he appears as a non-compiler in other collections.'),

  (2313, 'ibn_hajar', 'thiqa',
   'Abu Sa''id al-Khudri. Companion; tabaqa reads "he and his father have '
   'companionship", caught by pass 3, listed here so the intent is explicit.')
ON CONFLICT (narrator_id, scholar) DO UPDATE
  SET rank_code = EXCLUDED.rank_code, note = EXCLUDED.note;

COMMIT;

\echo 'narrator overrides loaded'
