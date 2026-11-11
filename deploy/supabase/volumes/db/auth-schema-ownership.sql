-- Put the `auth` schema in a state GoTrue can work with. Safe to run on every
-- start, and safe to run after a restore.
--
-- The supabase/postgres image ships a pre-seeded `auth` schema owned by
-- supabase_admin, whose helper functions (auth.uid/role/email) are owned by
-- postgres. GoTrue connects as supabase_auth_admin — deliberately not a
-- superuser — and its first migration does `CREATE OR REPLACE FUNCTION
-- auth.uid()`, which fails with:
--
--   ERROR: must be owner of function uid (SQLSTATE 42501)
--
-- and crash-loops the auth container. GoTrue does not create the schema itself
-- either: its migrator issues an unqualified `CREATE TABLE
-- "schema_migrations"` and relies on the role's search_path resolving to
-- `auth`.
--
-- The discriminator is the ownership of auth.uid():
--   * pre-seeded, never used  → owned by postgres        → replace the schema
--   * restored from the hosted project → owned by supabase_auth_admin → leave
--     it completely alone; its auth.schema_migrations is at the same head
--     (20260831180000) this GoTrue ships, so no migration runs at all.
--
-- Dropping a restored schema would delete every user, so the test is
-- deliberately narrow: only a schema that still carries the image's own
-- placeholder functions is replaced.

DO $$
DECLARE
  uid_owner name;
BEGIN
  SELECT pg_get_userbyid(p.proowner)
    INTO uid_owner
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'auth' AND p.proname = 'uid'
   LIMIT 1;

  IF uid_owner IS NOT NULL AND uid_owner <> 'supabase_auth_admin' THEN
    DROP SCHEMA auth CASCADE;
    uid_owner := NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
  END IF;
END $$;

GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
