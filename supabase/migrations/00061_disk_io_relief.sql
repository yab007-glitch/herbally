-- Disk IO relief for the free-tier Nano instance.
--
-- Evidence (Supabase Query Performance, 2026-10-19):
--   * increment_herb_view(uuid)  ~79k calls, 29.9% of DB time.
--     It ran once per dynamic herb-page render (server `after()`), i.e. per
--     bot/crawler/prefetch request, and every UPDATE also maintained
--     idx_herbs_view_count, forcing a non-HOT write.
--   * Herb list by category     ~48k calls, 28.7% of DB time (no partial
--     composite index for is_published + category_id).
--   * All-herbs list            ~4.4k calls, 10.2% of DB time.
--
-- View tracking now happens from a client beacon once per visitor/slug/day
-- (src/app/api/herbs/view/route.ts), so a slug-addressed RPC avoids the extra
-- SELECT. The view_count index was only used by a generateStaticParams query
-- that is disabled (PRERENDER_HERB_LIMIT = 0); dropping it lets view_count
-- updates become HOT.

CREATE OR REPLACE FUNCTION public.increment_herb_view_by_slug(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.herbs
  SET view_count = view_count + 1
  WHERE slug = p_slug
    AND is_published = true;
$$;

REVOKE ALL ON FUNCTION public.increment_herb_view_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_herb_view_by_slug(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_herb_view_by_slug(text) TO service_role;

-- Stop the server-side per-render writes immediately. The application catches
-- this error and continues; the new beacon uses the slug RPC above. Revoke the
-- default PUBLIC grant too — service_role inherits EXECUTE through PUBLIC.
REVOKE ALL ON FUNCTION public.increment_herb_view(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_herb_view(uuid) FROM service_role;

DROP INDEX IF EXISTS public.idx_herbs_view_count;

CREATE INDEX IF NOT EXISTS idx_herbs_published_category
  ON public.herbs (category_id)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_herbs_published_name
  ON public.herbs (name)
  WHERE is_published = true;
