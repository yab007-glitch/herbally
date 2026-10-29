-- Cached assistant responses can repeat sensitive health information.
-- Keep the existing rows, but limit all access to the server's service role.
-- Applied to production as private_ai_response_cache; safe to reapply.
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_response_cache is publicly readable" ON public.ai_response_cache;
REVOKE ALL PRIVILEGES ON TABLE public.ai_response_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_response_cache TO service_role;
