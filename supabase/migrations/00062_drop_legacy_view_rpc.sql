-- Remove the legacy per-render view RPC.
--
-- 00061 replaced it with `increment_herb_view_by_slug`, which is called only by
-- the client-beacon route, and revoked the legacy function from PUBLIC and
-- service_role. Nothing in the application references it any more, so drop it
-- rather than leaving a dead, revoked function in the schema.
DROP FUNCTION IF EXISTS public.increment_herb_view(uuid);
