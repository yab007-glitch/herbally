-- Herb page views used to UPDATE the wide `herbs` row on every single view.
-- `herbs` carries ~9 KB per row and eleven indexes, so each view rewrote the
-- whole record and every index, and the RPC was the single largest consumer of
-- database time (measured: ~79k calls / ~9.8M ms in pg_stat_statements).
--
-- Counting now lives in its own narrow table (two columns plus a timestamp),
-- so a view costs one small row write instead of a full-record rewrite.
--
-- APPLY THIS MIGRATION BEFORE deploying code that reads public.herb_popularity.

CREATE TABLE IF NOT EXISTS public.herb_view_counts (
  herb_id    uuid PRIMARY KEY REFERENCES public.herbs(id) ON DELETE CASCADE,
  views      bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Internal counter: server-only, same posture as ai_response_cache.
ALTER TABLE public.herb_view_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.herb_view_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.herb_view_counts TO service_role;

-- Seed from the existing counters so popularity ordering does not reset to zero.
INSERT INTO public.herb_view_counts (herb_id, views)
SELECT id, GREATEST(COALESCE(view_count, 0), 0)
FROM public.herbs
ON CONFLICT (herb_id) DO NOTHING;

-- Same signature and contract as before; only the write target changed.
CREATE OR REPLACE FUNCTION public.increment_herb_view_by_slug(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  INSERT INTO public.herb_view_counts AS c (herb_id, views, updated_at)
  SELECT h.id, 1, now()
  FROM public.herbs h
  WHERE h.slug = p_slug AND h.is_published = true
  ON CONFLICT (herb_id) DO UPDATE
    SET views = c.views + 1, updated_at = now();
$function$;

REVOKE ALL ON FUNCTION public.increment_herb_view_by_slug(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_herb_view_by_slug(text) TO service_role;

-- Build-time prerender priority: same shape the page ordered by before.
-- Owned by the migration role, so the join does not require the caller to have
-- privileges on the counter table; only published herbs are exposed.
CREATE OR REPLACE VIEW public.herb_popularity AS
SELECT h.slug, COALESCE(c.views, 0) AS views
FROM public.herbs h
LEFT JOIN public.herb_view_counts c ON c.herb_id = h.id
WHERE h.is_published = true;

GRANT SELECT ON public.herb_popularity TO anon, authenticated;
