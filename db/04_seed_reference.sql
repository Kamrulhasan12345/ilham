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

-- First admin (backend PRD §12 decision 6). Registration never mints an
-- admin, so a fresh database would have nobody to verify teachers. This row
-- fixes that. Email admin@ilham.test, password 'ilham': disposable local-dev
-- credential, same bargain as every other password in this repo. Change it
-- before this is ever reachable from outside loopback. run_ddl.sh rebuilds
-- from empty schemas, where the UPDATE matches nothing and the INSERT seeds.
UPDATE app.admins SET password_hash = '$2a$10$WGZoaLJDh9tFzD.HJhqGq.9N2BopjGTXfLIp74mCy9ITcnUnAzEDa' WHERE email = 'admin@ilham.test';
INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
SELECT 'admin@ilham.test', '$2a$10$WGZoaLJDh9tFzD.HJhqGq.9N2BopjGTXfLIp74mCy9ITcnUnAzEDa', 'Seeded Admin', 'admin', 'super'
WHERE NOT EXISTS (SELECT 1 FROM app.admins WHERE email = 'admin@ilham.test');
-- The repair half runs first: older databases carry this row with a
-- placeholder hash, and the assert_email_unique trigger fires before any
-- uniqueness check, so ON CONFLICT never fires. UPDATE first, INSERT second.
