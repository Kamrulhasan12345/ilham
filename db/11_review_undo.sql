-- =============================================================================
-- ILHAM — 11_review_undo.sql
-- Additive migration, run once against an already-bootstrapped database, as
-- the database owner.
--
-- Each review item records the progress row it changed and that row's state
-- just before the change. Deleting a session then restores those values
-- exactly. The old delete replayed the remaining review items instead, and a
-- replay cannot see a teacher override: it reset overridden mastery to what
-- the reviews alone gave.
--
-- The API refuses the delete when the row changed after the session (a later
-- review or an override). A restore would erase that later change.
--
-- prev_mastery IS NULL marks an item recorded before this migration. It holds
-- no snapshot, so the API refuses to delete its session.
--
-- ON DELETE SET NULL: deleting an assignment deletes its progress rows, and
-- the review history stays. An item with no progress row has nothing to
-- restore.
--
-- ADD COLUMN keeps the table-level grants from 05_post_load.sql.
-- Regenerate db/ilham.dump afterwards.
-- =============================================================================

\set ON_ERROR_STOP on

ALTER TABLE app.review_items
    ADD COLUMN progress_id         bigint REFERENCES app.progress ON DELETE SET NULL,
    ADD COLUMN prev_mastery        smallint CHECK (prev_mastery BETWEEN 0 AND 4),
    ADD COLUMN prev_times_reviewed integer  CHECK (prev_times_reviewed >= 0),
    ADD COLUMN prev_last_reviewed  timestamptz;

CREATE INDEX ON app.review_items (progress_id);
