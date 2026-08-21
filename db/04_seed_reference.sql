-- =============================================================================
-- ILHAM — 04_seed_reference.sql
-- corpus.rank_levels: the ordinal scale chain_strength does arithmetic on.
-- Must load BEFORE staging.rank_map (which FKs to it) and before §3.5.
--
-- The scale is a modelling decision, not a fact from the source: rijal grading
-- is a scholarly judgement expressed in free text, and collapsing it to six
-- ordinal buckets is a deliberate simplification. Raw strings stay on
-- corpus.narrators for display honesty. Document this in report §ETL.
-- =============================================================================

\set ON_ERROR_STOP on

INSERT INTO corpus.rank_levels (rank_code, label_ar, ordinal, weight) VALUES
    ('thiqa',  'ثقة',   6, 0.95),   -- trustworthy
    ('saduq',  'صدوق',  5, 0.80),   -- truthful, minor slips
    ('maqbul', 'مقبول', 4, 0.60),   -- acceptable when corroborated
    ('layyin', 'لين',   3, 0.40),   -- soft
    ('daif',   'ضعيف',  2, 0.25),   -- weak
    ('matruk', 'متروك', 1, 0.10);   -- abandoned

-- Ungraded narrators are NOT given a row here. A narrator with no code is
-- treated by chain_strength as neutral 0.50 — ungraded is not the same as
-- criticised, and inventing a 'majhul' rank_level would let an absent judgement
-- masquerade as a judgement.
