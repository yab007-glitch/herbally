-- 00044_reconcile_chat_sessions.sql
-- H-2 (audit 2026-06-22): chat_sessions was defined twice with incompatible
-- schemas. 00010 created it with `messages JSONB NOT NULL DEFAULT '[]'` and
-- `herb_context UUID REFERENCES herbs(id)`. 00020 used `CREATE TABLE IF NOT
-- EXISTS` (a no-op since 00010 already ran) intending `herb_context TEXT` and
-- a separate `chat_messages` table. Net live schema: a dead `messages` column
-- and `herb_context` as a UUID FK — but the guest chat functions
-- (create_guest_chat_session) take `p_herb_context TEXT` and insert a slug
-- string, which only works because callers pass NULL. Any non-null slug would
-- fail Postgres UUID coercion.
--
-- Canonicalize on the 00020 model (the one the code actually uses):
--   * drop the dead `messages` JSONB column (chat_messages is the store)
--   * change `herb_context` UUID → TEXT (holds a herb slug, not an id)
--   * drop the now-invalid herbs(id) FK
-- Idempotent and safe in both drift states:
--   * if live schema is 00010 (UUID + messages): performs the changes.
--   * if live schema is already 00020 (TEXT, no messages): all statements are
--     no-ops (DROP COLUMN IF EXISTS, type is already TEXT, FK absent).

-- Drop the herbs(id) FK on herb_context (auto-named by Postgres in 00010).
ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_herb_context_fkey;

-- Reconcile herb_context to TEXT (holds a slug). Existing UUID values, if any,
-- are stringified; NULLs stay NULL. If the column is already TEXT this is a
-- no-op type cast.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_sessions'
      AND column_name = 'herb_context'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.chat_sessions
      ALTER COLUMN herb_context TYPE TEXT USING herb_context::text;
  END IF;
END $$;

-- Drop the dead `messages` JSONB column (replaced by the chat_messages table).
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS messages;