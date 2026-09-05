-- =============================================================================
-- ILHAM — 06_refresh_tokens.sql
-- Additive migration, run once against an already-bootstrapped database.
-- Adds the refresh-token table docs/backend-prd.md §8.1 specifies for
-- revocable logout. 05_post_load.sql already ran and sealed its schema-wide
-- grant before this table existed, so this file grants privileges on its own
-- new table explicitly.
-- =============================================================================

\set ON_ERROR_STOP on

CREATE TABLE app.refresh_tokens (
    token_hash text PRIMARY KEY,          -- sha256 of the token, never the token
    user_id    integer NOT NULL,          -- polymorphic -> trigger, like notes
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.refresh_tokens (user_id);
CREATE TRIGGER trg_refresh_user BEFORE INSERT OR UPDATE OF user_id
ON app.refresh_tokens FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('user_id');

GRANT SELECT, INSERT, UPDATE, DELETE ON app.refresh_tokens TO ilham_app;
