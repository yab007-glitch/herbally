-- Precompute herb page bundles.
--
-- Evidence (pg_stat_statements, window 2026-09-07 .. 2026-11-08):
--   * herb_page_bundle: 31,983 calls, mean 135.5 ms, max 2,968 ms — the dominant
--     statement-timeout query on the Free-tier Nano (321 timeouts in 24 h at peak).
--   * Every call touches ~1,470 shared buffers. Execution is ~18 ms; planning the
--     eight-leg statement is ~36 ms, so planning costs more than execution.
--   * The payload only changes when content is imported or edited.
--
-- The page already caches the jsonb for three days (unstable_cache). Precompute it
-- once per herb and serve it from a single indexed row: ~1 buffer instead of ~1,470.
-- Writes to any source table queue the slug; the next read rebuilds that one slug,
-- so edits stay fresh without cron, an extension, or another service to pay for.

CREATE TABLE IF NOT EXISTS public.herb_page_bundles (
  slug     text PRIMARY KEY REFERENCES public.herbs (slug) ON UPDATE CASCADE ON DELETE CASCADE,
  payload  jsonb NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.herb_page_bundles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.herb_page_bundles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.herb_page_bundles TO service_role;

-- Slugs queued by the triggers below. Rows are removed when the bundle is rebuilt.
CREATE TABLE IF NOT EXISTS public.herb_bundle_dirty (
  slug      text PRIMARY KEY,
  queued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.herb_bundle_dirty ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.herb_bundle_dirty FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.herb_bundle_dirty TO service_role;

-- SECURITY DEFINER so edits made through the admin UI (authenticated role, RLS)
-- can still queue the slug. NEW/OLD are read per TG_OP: referencing NEW in a
-- DELETE trigger is not safe.
CREATE OR REPLACE FUNCTION public.mark_herb_bundle_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_slug text;
BEGIN
  IF tg_table_name IN ('herbs', 'herb_pubmed_monographs') THEN
    v_slug := CASE WHEN tg_op = 'DELETE' THEN old.slug ELSE new.slug END;
  ELSIF tg_table_name = 'herb_faqs' THEN
    SELECT h.slug INTO v_slug
    FROM public.herbs h
    WHERE h.id = CASE WHEN tg_op = 'DELETE' THEN old.herb_id ELSE new.herb_id END;
  ELSE
    v_slug := CASE WHEN tg_op = 'DELETE' THEN old.herb_slug ELSE new.herb_slug END;
  END IF;

  IF v_slug IS NOT NULL THEN
    INSERT INTO public.herb_bundle_dirty (slug, queued_at)
    VALUES (v_slug, now())
    ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_herb_bundle_dirty() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_herbs_bundle_dirty ON public.herbs;
CREATE TRIGGER trg_herbs_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herbs
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

DROP TRIGGER IF EXISTS trg_herb_monographs_bundle_dirty ON public.herb_monographs;
CREATE TRIGGER trg_herb_monographs_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herb_monographs
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

DROP TRIGGER IF EXISTS trg_herb_monograph_sources_bundle_dirty ON public.herb_monograph_sources;
CREATE TRIGGER trg_herb_monograph_sources_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herb_monograph_sources
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

DROP TRIGGER IF EXISTS trg_herb_faqs_bundle_dirty ON public.herb_faqs;
CREATE TRIGGER trg_herb_faqs_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herb_faqs
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

DROP TRIGGER IF EXISTS trg_herb_regulatory_evidence_bundle_dirty ON public.herb_regulatory_evidence;
CREATE TRIGGER trg_herb_regulatory_evidence_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herb_regulatory_evidence
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

DROP TRIGGER IF EXISTS trg_herb_pubmed_monographs_bundle_dirty ON public.herb_pubmed_monographs;
CREATE TRIGGER trg_herb_pubmed_monographs_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.herb_pubmed_monographs
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

-- Renamed from the old public.herb_page_bundle(). `popularity` is gone: the page
-- never read it (the only consumer of herb_popularity is generateStaticParams),
-- so the view join was dead weight on every build.
CREATE OR REPLACE FUNCTION public.build_herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $function$
  with h as (select * from public.herbs where slug = p_slug and is_published limit 1)
  select case when not exists (select 1 from h) then null else jsonb_build_object(
    'herb', (select to_jsonb(x) from h x),
    'regulatory', (select to_jsonb(r) from public.herb_regulatory_evidence r where r.herb_slug = p_slug limit 1),
    'monograph', (select to_jsonb(m) from public.herb_monographs m where m.herb_slug = p_slug and m.status = 'published' limit 1),
    -- Every imported regulator excerpt for this herb, not just one. Health Canada and
    -- NCCIH can both speak about the same plant; the page shows each in its own block
    -- with its own licence, instead of one overwriting the other.
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', s.source,
        'licence', s.licence,
        'attribution', s.attribution,
        'url', s.url,
        'claims', s.claims,
        'safety', s.safety,
        'doses', s.doses,
        'monograph_date', s.monograph_date
      ) order by s.source)
      from public.herb_monograph_sources s where s.herb_slug = p_slug
    ), '[]'::jsonb),
    'pubmed', (select to_jsonb(p) from public.herb_pubmed_monographs p where p.slug = p_slug limit 1),
    'faqs', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.sort_order)
      from (select question, answer, category, translations, sort_order
            from public.herb_faqs where herb_id = (select id from h) order by sort_order limit 6) f
    ), '[]'::jsonb),
    'related', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'slug', r.slug, 'scientific_name', r.scientific_name))
      from public.herbs r
      where r.is_published and r.slug = any(coalesce((select related_slugs from h), '{}'::text[]))
    ), '[]'::jsonb)
  ) end;
$function$;

REVOKE ALL ON FUNCTION public.build_herb_page_bundle(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_herb_page_bundle(text) TO service_role;

-- Same name and response shape the app already calls. One table read in the hot
-- path; a rebuild only happens for a missing bundle or a slug queued by a write.
CREATE OR REPLACE FUNCTION public.herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT b.payload INTO v_payload
  FROM public.herb_page_bundles b
  WHERE b.slug = p_slug;

  IF v_payload IS NULL
     OR EXISTS (SELECT 1 FROM public.herb_bundle_dirty d WHERE d.slug = p_slug) THEN
    v_payload := public.build_herb_page_bundle(p_slug);

    IF v_payload IS NULL THEN
      DELETE FROM public.herb_page_bundles b WHERE b.slug = p_slug;
    ELSE
      INSERT INTO public.herb_page_bundles (slug, payload, built_at)
      VALUES (p_slug, v_payload, now())
      ON CONFLICT (slug) DO UPDATE
        SET payload = excluded.payload,
            built_at = excluded.built_at;
    END IF;

    DELETE FROM public.herb_bundle_dirty d WHERE d.slug = p_slug;
  END IF;

  RETURN v_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.herb_page_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.herb_page_bundle(text) TO anon, authenticated, service_role;

-- Backfills the 3,238 bundles in bounded batches (call until it returns 0), and
-- picks up any slug queued by an import or admin edit. Not on a schedule: the
-- read path already rebuilds queued slugs, so this is only for warm-up.
CREATE OR REPLACE FUNCTION public.refresh_herb_page_bundles(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT h.slug
    FROM public.herbs h
    WHERE h.is_published
      AND (
        EXISTS (SELECT 1 FROM public.herb_bundle_dirty d WHERE d.slug = h.slug)
        OR NOT EXISTS (SELECT 1 FROM public.herb_page_bundles b WHERE b.slug = h.slug)
      )
    ORDER BY h.slug
    LIMIT coalesce(p_limit, 500)
  LOOP
    PERFORM public.herb_page_bundle(r.slug);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_herb_page_bundles(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_herb_page_bundles(integer) TO service_role;
