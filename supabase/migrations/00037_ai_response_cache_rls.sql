-- Lock down the AI response cache.
--
-- Previously ai_response_cache had NO row-level security, so anyone with the
-- public anon key (exposed in the browser) could INSERT a row with a known
-- prompt_hash and a malicious response — and /api/chat would serve that
-- cached response verbatim (cache poisoning).
--
-- Now: anyone may READ (it is a shared, prompt-hash-keyed cache), but only
-- the service role (used server-side by /api/chat to populate the cache) can
-- write. The service role bypasses RLS, so no INSERT/UPDATE/DELETE policy is
-- needed for it; anon/authenticated get no write policy and are blocked.

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_response_cache is publicly readable"
  ON public.ai_response_cache
  FOR SELECT
  USING (true);
