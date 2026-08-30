-- =============================================================================
-- ILHAM — 98_smoke_test.sql
-- Exercises every checklist mechanism against synthetic data. Run after the
-- DDL, before the real ETL. Any RAISE EXCEPTION here means a mechanism the
-- report claims to demonstrate does not actually work.
-- =============================================================================

\set ON_ERROR_STOP on

-- --- fixture: corpus -------------------------------------------------------
INSERT INTO corpus.collections (slug, title_ar, title_en)
VALUES ('bukhari', 'صحيح البخاري', 'Sahih al-Bukhari');

INSERT INTO corpus.chapters (collection_id, seq, title_ar)
SELECT collection_id, s, 'باب' FROM corpus.collections, generate_series(1,3) s;

INSERT INTO corpus.hadiths (hadith_id, collection_id, chapter_id, hadith_num,
                            text_plain, text_diac, sanad_count)
SELECT g, c.collection_id, ch.chapter_id, g::text, 'متن '||g, 'مَتْن '||g, 1
FROM generate_series(1,5) g
CROSS JOIN corpus.collections c
JOIN corpus.chapters ch ON ch.collection_id = c.collection_id AND ch.seq = 1;

INSERT INTO corpus.narrators (narrator_id, display_name, name,
                              rank_ibn_hajar, rank_dhahabi, is_placeholder) VALUES
    (1, 'أَبُو هُرَيْرَةَ', 'أبو هريرة',  'thiqa',  'thiqa',  false),
    (2, 'مَالِكُ بْنُ أَنَس', 'مالك بن أنس', 'thiqa',  'saduq',  false),
    (3, 'فُلَانٌ الضَّعِيف', 'فلان الضعيف', 'daif',   NULL,     false),
    (4, '[راو موضع إبهام]', '[راو موضع إبهام]', NULL, NULL,   true),
    (5, 'مَجْهُولٌ مُسَمًّى', 'مجهول مسمى', NULL,     NULL,     false);

-- h1: strong chain, no an'ana         -> min(0.95, 0.80) = 0.80
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, narrator_id,
                                raw_name, transmission_word, is_compiler, resolution) VALUES
    (1,1,1,1,'أبو هريرة','حدثنا',false,'A'),
    (1,1,2,2,'مالك بن أنس','حدثنا',false,'A'),
    (1,1,3,NULL,'البخاري',NULL,true,'X');

-- h2: an'ana on a vocalised عَنْ      -> 0.80 - 0.05 = 0.75  (dead in the draft)
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, narrator_id,
                                raw_name, transmission_word, is_compiler, resolution) VALUES
    (2,1,1,1,'أبو هريرة','حَدَّثَنَا',false,'A'),
    (2,1,2,2,'مالك بن أنس','عَنْ',false,'A'),
    (2,1,3,NULL,'البخاري',NULL,true,'X');

-- h3: weak narrator                    -> 0.25
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, narrator_id,
                                raw_name, transmission_word, is_compiler, resolution) VALUES
    (3,1,1,1,'أبو هريرة','حدثنا',false,'A'),
    (3,1,2,3,'فلان الضعيف','حدثنا',false,'A'),
    (3,1,3,NULL,'البخاري',NULL,true,'X');

-- h4: placeholder 0.15, and a named-but-ungraded 0.50 -> min = 0.15
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, narrator_id,
                                raw_name, transmission_word, is_compiler, resolution) VALUES
    (4,1,1,5,'مجهول مسمى','حدثنا',false,'A'),
    (4,1,2,4,'[راو موضع إبهام]','حدثنا',false,'A'),
    (4,1,3,NULL,'البخاري',NULL,true,'X');

-- h5: two sanads, best wins -> max(0.25, 0.80) = 0.80
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, narrator_id,
                                raw_name, transmission_word, is_compiler, resolution) VALUES
    (5,1,1,3,'فلان الضعيف','حدثنا',false,'A'),
    (5,1,2,NULL,'البخاري',NULL,true,'X'),
    (5,2,1,1,'أبو هريرة','حدثنا',false,'A'),
    (5,2,2,2,'مالك بن أنس','حدثنا',false,'A'),
    (5,2,3,NULL,'البخاري',NULL,true,'X');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES (1,0.80),(2,0.75),(3,0.25),(4,0.15),(5,0.80))
                          AS t(h, expect) LOOP
    IF corpus.chain_strength(r.h) IS DISTINCT FROM r.expect THEN
      RAISE EXCEPTION 'chain_strength(%) = %, expected %',
        r.h, corpus.chain_strength(r.h), r.expect;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS chain_strength (incl. vocalised an''ana penalty)';
END $$;

-- -----------------------------------------------------------------------------
-- normalize_arabic edge punctuation, and the columns that depend on the codes
-- it feeds. Asserted here as well as in 00_init.sql because this is the file
-- that runs on every rebuild and the failure mode is silent: 'ثقة.' and 'ثقة'
-- comparing unequal costs ~350 narrators their grade with no error anywhere.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF corpus.normalize_arabic('ثقة.') <> corpus.normalize_arabic('ثقة') THEN
    RAISE EXCEPTION 'trailing punctuation splits equal grades: [%] vs [%]',
      corpus.normalize_arabic('ثقة.'), corpus.normalize_arabic('ثقة');
  END IF;
  -- Interior punctuation must survive: 13_ranks pass 2 tokenises on space, and
  -- narrator lineage strings are comma-separated.
  IF corpus.normalize_arabic('ثقة، حافظ') = corpus.normalize_arabic('ثقة حافظ') THEN
    RAISE EXCEPTION 'interior punctuation is being eaten';
  END IF;
  -- First-token extraction is what pass 2 matches on.
  IF split_part(corpus.normalize_arabic('ثقة حافظ فقيه'), ' ', 1)
     <> corpus.normalize_arabic('ثقة') THEN
    RAISE EXCEPTION 'first-token extraction broken: rank pass 2 would miss compounds';
  END IF;
  RAISE NOTICE 'PASS normalize_arabic edge punctuation + token extraction';
END $$;

DO $$
DECLARE v_cols int;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'corpus' AND table_name = 'narrators'
     AND column_name IN ('rank_ibn_hajar_via', 'rank_dhahabi_via');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION 'rank_*_via columns missing — 13_ranks cannot record derivation';
  END IF;
  -- The via codes are a closed set; a typo in 13_ranks must fail loudly.
  BEGIN
    INSERT INTO corpus.narrators (narrator_id, display_name, name, rank_ibn_hajar_via)
    VALUES (-999, 'x', 'x', 'Z');
    RAISE EXCEPTION 'rank_ibn_hajar_via accepted an out-of-set code';
  EXCEPTION WHEN check_violation THEN
    NULL;   -- expected
  END;
  RAISE NOTICE 'PASS rank derivation columns (E/T/S/O constrained)';
END $$;

-- -----------------------------------------------------------------------------
-- hadith_translations.match_via — same closed-set discipline.
--
-- Stage 14 attaches English by matching Arabic text, in five tiers of falling
-- strength. If a typo in that stage wrote an unknown tier the row would still
-- load and the report would quote a confidence that does not exist, so the
-- constraint has to refuse it here.
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_hid int;
BEGIN
  INSERT INTO corpus.collections (slug, title_ar) VALUES ('smoke-tr', 'ت')
    RETURNING collection_id INTO v_hid;
  INSERT INTO corpus.chapters (collection_id, seq, title_ar) VALUES (v_hid, 1, 'ب');
  INSERT INTO corpus.hadiths (hadith_id, collection_id, chapter_id, hadith_num,
                              text_plain, text_diac, sanad_count)
  SELECT -998, v_hid, chapter_id, '1', 'ن', 'ن', 1
    FROM corpus.chapters WHERE collection_id = v_hid;

  -- A valid tier is accepted.
  INSERT INTO corpus.hadith_translations (hadith_id, text_full, match_via)
  VALUES (-998, 'text', 'E');

  -- An unknown tier is not.
  BEGIN
    UPDATE corpus.hadith_translations SET match_via = 'Z' WHERE hadith_id = -998;
    RAISE EXCEPTION 'match_via accepted an out-of-set code';
  EXCEPTION WHEN check_violation THEN
    NULL;   -- expected
  END;

  -- One canonical translation per (hadith, lang): a second English row for the
  -- same hadith must be refused, not silently kept as a duplicate.
  BEGIN
    INSERT INTO corpus.hadith_translations (hadith_id, text_full, match_via)
    VALUES (-998, 'other', 'P');
    RAISE EXCEPTION 'hadith_translations accepted two English rows for one hadith';
  EXCEPTION WHEN unique_violation THEN
    NULL;   -- expected
  END;

  DELETE FROM corpus.hadith_translations WHERE hadith_id = -998;
  DELETE FROM corpus.hadiths  WHERE hadith_id = -998;
  DELETE FROM corpus.chapters WHERE collection_id = v_hid;
  DELETE FROM corpus.collections WHERE collection_id = v_hid;
  RAISE NOTICE 'PASS hadith_translations match_via + one-per-lang';
END $$;

-- --- ISA -------------------------------------------------------------------
-- is_verified must be set: a new teacher starts unverified and the circles
-- below would be refused. The gate itself is tested after they are created.
INSERT INTO app.teachers (email, password_hash, full_name, role, institution, is_verified)
VALUES ('t1@x.io','$2b$','Ustadh Karim','teacher','Dar al-Hadith', true);
INSERT INTO app.students (email, password_hash, full_name, role, student_level)
SELECT 's'||g||'@x.io','$2b$','Student '||g,'student','beginner'
FROM generate_series(1,4) g;
INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
VALUES ('a1@x.io','$2b$','Root','admin','super');

DO $$
DECLARE v_all int; v_only int;
BEGIN
  SELECT count(*) INTO v_all  FROM app.users;
  SELECT count(*) INTO v_only FROM ONLY app.users;
  IF v_all <> 6 OR v_only <> 0 THEN
    RAISE EXCEPTION 'ISA broken: hierarchy=% ONLY=% (expected 6 / 0)', v_all, v_only;
  END IF;
  -- shared sequence: user_id unique across all three subtypes
  IF (SELECT count(DISTINCT user_id) FROM app.users) <> 6 THEN
    RAISE EXCEPTION 'ISA broken: user_id not unique across subtypes';
  END IF;
  RAISE NOTICE 'PASS ISA hierarchy + shared sequence';
END $$;

-- GAP 1: cross-subtype email collision must be refused
DO $$
BEGIN
  INSERT INTO app.students (email, password_hash, full_name, role)
  VALUES ('t1@x.io','$2b$','Impostor','student');
  RAISE EXCEPTION 'GAP1 FAILED: cross-subtype duplicate email was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS cross-subtype email uniqueness';
END $$;

-- GAP 2: polymorphic reference must be checked
DO $$
BEGIN
  INSERT INTO app.notes (user_id, hadith_id, body) VALUES (9999, 1, 'ghost');
  RAISE EXCEPTION 'GAP2 FAILED: note accepted for nonexistent user';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS polymorphic user reference check';
END $$;

-- --- procedure + triggers --------------------------------------------------
INSERT INTO app.circles (teacher_id, name)
SELECT user_id, 'Halaqa A' FROM app.teachers;

-- verification gate: an unverified teacher gets no circle. The teacher is
-- added and removed here, so the user counts above stay correct.
DO $$
DECLARE v_tid int;
BEGIN
  INSERT INTO app.teachers (email, password_hash, full_name, role, institution)
  VALUES ('t2@x.io','$2b$','Unverified','teacher','Unknown')
  RETURNING user_id INTO v_tid;
  BEGIN
    INSERT INTO app.circles (teacher_id, name) VALUES (v_tid, 'Halaqa B');
    RAISE EXCEPTION 'GATE FAILED: unverified teacher got a circle';
  EXCEPTION WHEN check_violation THEN
    NULL;   -- expected
  END;
  -- and the same teacher passes once an admin verifies them
  UPDATE app.teachers SET is_verified = true WHERE user_id = v_tid;
  INSERT INTO app.circles (teacher_id, name) VALUES (v_tid, 'Halaqa B');
  DELETE FROM app.circles  WHERE teacher_id = v_tid;
  DELETE FROM app.teachers WHERE user_id = v_tid;
  RAISE NOTICE 'PASS circle verification gate';
END $$;

INSERT INTO app.enrollments (circle_id, student_id)
SELECT c.circle_id, s.user_id FROM app.circles c, app.students s;
INSERT INTO app.study_sets (owner_id, name)
SELECT user_id, 'Set 1' FROM app.teachers;
INSERT INTO app.set_items (set_id, hadith_id)
SELECT s.set_id, h.hadith_id FROM app.study_sets s, corpus.hadiths h;

-- NOTE: PostgreSQL forbids subqueries in CALL arguments ("cannot use subquery
-- in CALL argument"). Arguments must be literals or already-bound parameters,
-- so the API layer must SELECT the ids first and pass them as $1/$2/$3.
SELECT circle_id AS v_circle FROM app.circles LIMIT 1 \gset
SELECT set_id    AS v_set    FROM app.study_sets LIMIT 1 \gset
CALL app.assign_study_set(:v_circle, :v_set, (current_date + 14));

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM app.progress;
  IF v <> 20 THEN RAISE EXCEPTION 'fan-out wrong: % rows, expected 4x5=20', v; END IF;
  RAISE NOTICE 'PASS assign_study_set fan-out (% rows)', v;
END $$;

-- second CALL mints a NEW assignment: two obligations, not a dedup
CALL app.assign_study_set(:v_circle, :v_set, (current_date + 28));

DO $$
DECLARE v int; a int;
BEGIN
  SELECT count(*) INTO v FROM app.progress;
  SELECT count(*) INTO a FROM app.assignments;
  IF v <> 40 OR a <> 2 THEN
    RAISE EXCEPTION 'replay semantics wrong: progress=% assignments=% (expected 40/2)', v, a;
  END IF;
  RAISE NOTICE 'PASS repeat assignment creates a second obligation';
END $$;

-- trigger 4a: derived stats maintained without the app touching them
SELECT set_config('ilham.user_id', (SELECT user_id::text FROM app.teachers LIMIT 1), false);

UPDATE app.progress SET mastery = 4, times_reviewed = times_reviewed + 1
WHERE student_id = (SELECT min(user_id) FROM app.students)
  AND hadith_id IN (1,2,3);

DO $$
DECLARE m int; r int; sid int;
BEGIN
  SELECT min(user_id) INTO sid FROM app.students;
  SELECT mastered_count, review_count INTO m, r
  FROM app.student_stats WHERE student_id = sid;
  -- 3 distinct hadiths mastered even though each was assigned twice (6 rows)
  IF m <> 3 THEN RAISE EXCEPTION '4a wrong: mastered_count=%, expected 3 distinct', m; END IF;
  IF r <> 6 THEN RAISE EXCEPTION '4a wrong: review_count=%, expected 6', r; END IF;
  RAISE NOTICE 'PASS trigger 4a derived stats (DISTINCT across assignments)';
END $$;

-- trigger 4b: shadow table captured the overrides with the actor
DO $$
DECLARE v int; actor int;
BEGIN
  SELECT count(*), min(changed_by) INTO v, actor
  FROM app.audit_log WHERE table_name = 'app.progress';
  IF v <> 6 THEN RAISE EXCEPTION '4b wrong: % audit rows, expected 6', v; END IF;
  IF actor IS NULL THEN RAISE EXCEPTION '4b wrong: changed_by not captured'; END IF;
  RAISE NOTICE 'PASS trigger 4b audit shadow table (% rows, actor=%)', v, actor;
END $$;

-- --- transaction control: the procedure is all-or-nothing ------------------
DO $$
DECLARE before_a int; after_a int; before_p int; after_p int;
BEGIN
  SELECT count(*) INTO before_a FROM app.assignments;
  SELECT count(*) INTO before_p FROM app.progress;
  BEGIN
    CALL app.assign_study_set(999999, 1, current_date);   -- bad circle -> FK error
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  SELECT count(*) INTO after_a FROM app.assignments;
  SELECT count(*) INTO after_p FROM app.progress;
  IF after_a <> before_a OR after_p <> before_p THEN
    RAISE EXCEPTION 'rollback failed: assignments %->%, progress %->%',
      before_a, after_a, before_p, after_p;
  END IF;
  RAISE NOTICE 'PASS all-or-nothing rollback on failed fan-out';
END $$;

-- --- the analytical queries actually execute -------------------------------
DO $$
DECLARE v int;
BEGIN
  PERFORM 1 FROM (
    SELECT n.narrator_id, coalesce(n.name_en, n.display_name) AS narrator,
           count(DISTINCT l.hadith_id) AS hadith_count
    FROM corpus.isnad_links l
    JOIN corpus.narrators n USING (narrator_id)
    WHERE NOT n.is_placeholder AND NOT l.is_compiler
    GROUP BY 1,2 ORDER BY hadith_count DESC LIMIT 25) q1;

  SELECT count(*) INTO v FROM (
    SELECT n.display_name, rh.ordinal, rd.ordinal
    FROM corpus.narrators n
    JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
    JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
    WHERE rh.ordinal <> rd.ordinal) q2;
  IF v <> 1 THEN RAISE EXCEPTION 'Q2 contested narrators: got %, expected 1', v; END IF;

  PERFORM 1 FROM corpus.isnad_edges LIMIT 1;

  PERFORM 1 FROM (
    SELECT u.full_name,
           count(DISTINCT p.hadith_id) FILTER (WHERE p.mastery >= 3) AS mastered,
           count(DISTINCT p.hadith_id) AS total_assigned
    FROM app.enrollments e
    JOIN app.students u ON u.user_id = e.student_id
    LEFT JOIN app.progress p ON p.student_id = e.student_id
    WHERE e.circle_id = (SELECT min(circle_id) FROM app.circles)
    GROUP BY u.user_id, u.full_name) q4;

  PERFORM 1 FROM (
    SELECT h.hadith_id, corpus.chain_strength(h.hadith_id) AS strength
    FROM corpus.hadiths h
    JOIN app.set_items si USING (hadith_id)
    WHERE si.set_id = (SELECT min(set_id) FROM app.study_sets)
    ORDER BY strength ASC NULLS LAST LIMIT 20) q5;

  RAISE NOTICE 'PASS all analytical queries execute against the schema';
END $$;

\echo '--- SMOKE TEST COMPLETE ---'
