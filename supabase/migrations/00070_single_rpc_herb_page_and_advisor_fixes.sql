-- Consolidate cold /herbs/[slug] renders into a single herb_page_bundle() RPC
-- and resolve the remaining Supabase Security & Performance Advisor findings.
--
-- Why:
--   1. Cold /herbs/[slug] renders still issued 6-7 PostgREST queries even after
--      migration 00067 precomputed herb_page_bundles:
--        - herbs?select=*,herb_categories(*),drug_interactions(*) (because
--          bundle.herb lacked the two nested embeds)
--        - herb_monograph_sources (queried directly despite being in the bundle)
--        - herbs category fallback for the 943 herbs with empty related_slugs
--          (no LIMIT -> 1,000-row / ~250 KB scan on the "Not Common" bucket)
--        - 2 queries for alphabetical prev/next neighbours
--        - 1 query for symptom_keywords peers
--   2. Enriching bundle.herb with herb_categories + drug_interactions, adding
--      neighbours + symptom_peers, and falling back related to symptom_peers
--      when related_slugs is empty collapses every cold herb page render to
--      1 single primary-key lookup on herb_page_bundles.
--   3. Existing 00067 rows are upgraded lazily on read using scalar-indexed
--      lookups (~3 ms) so deploying this migration does not cause a 37 MB
--      table-rewrite IO spike on the Free-tier Nano instance.

-- 1. Supabase Security Advisor: pin search_path on category_herb_counts().
--    The function exists in the hosted project but not in the migration chain,
--    so a fresh replay must skip the hardening rather than fail.
DO $$
BEGIN
  IF to_regprocedure('public.category_herb_counts()') IS NOT NULL THEN
    ALTER FUNCTION public.category_herb_counts() SET search_path = public, pg_temp;
  END IF;
END $$;

-- 2. Supabase Performance Advisor: cover the 4 unindexed foreign keys.
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON public.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_dosage_calculations_herb_id
  ON public.dosage_calculations (herb_id);
CREATE INDEX IF NOT EXISTS idx_herb_monographs_herb_id
  ON public.herb_monographs (herb_id);
CREATE INDEX IF NOT EXISTS idx_interaction_checks_herb_id
  ON public.interaction_checks (herb_id);

-- 3. Queue bundle rebuilds when drug_interactions change.
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
  ELSIF tg_table_name IN ('herb_faqs', 'drug_interactions') THEN
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

DROP TRIGGER IF EXISTS trg_drug_interactions_bundle_dirty ON public.drug_interactions;
CREATE TRIGGER trg_drug_interactions_bundle_dirty
  AFTER INSERT OR UPDATE OR DELETE ON public.drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.mark_herb_bundle_dirty();

-- 4. Build the complete herb page bundle using scalar PL/pgSQL variables so
--    every subquery plans as a direct single-table index lookup rather than a
--    cross-CTE Nested Loop.
CREATE OR REPLACE FUNCTION public.build_herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $function$
DECLARE
  v_herb record;
  v_category jsonb;
  v_interactions jsonb;
  v_prev jsonb;
  v_next jsonb;
  v_symptom_peers jsonb;
  v_related jsonb;
BEGIN
  SELECT * INTO v_herb
  FROM public.herbs
  WHERE slug = p_slug AND is_published
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_herb.category_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_category
    FROM public.herb_categories c
    WHERE c.id = v_herb.category_id
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(di)), '[]'::jsonb)
  INTO v_interactions
  FROM public.drug_interactions di
  WHERE di.herb_id = v_herb.id;

  SELECT jsonb_build_object('slug', p.slug, 'name', p.name, 'scientific_name', p.scientific_name)
  INTO v_prev
  FROM public.herbs p
  WHERE p.is_published AND p.name < v_herb.name AND p.slug <> p_slug
  ORDER BY p.name DESC
  LIMIT 1;

  SELECT jsonb_build_object('slug', n.slug, 'name', n.name, 'scientific_name', n.scientific_name)
  INTO v_next
  FROM public.herbs n
  WHERE n.is_published AND n.name > v_herb.name AND n.slug <> p_slug
  ORDER BY n.name ASC
  LIMIT 1;

  IF v_herb.symptom_keywords IS NOT NULL AND cardinality(v_herb.symptom_keywords) > 0 THEN
    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
    INTO v_symptom_peers
    FROM (
      SELECT h2.slug, h2.name, h2.scientific_name
      FROM public.herbs h2
      WHERE h2.is_published
        AND h2.slug <> p_slug
        AND h2.symptom_keywords @> v_herb.symptom_keywords[1:least(2, cardinality(v_herb.symptom_keywords))]
      LIMIT 6
    ) p;
  ELSE
    v_symptom_peers := '[]'::jsonb;
  END IF;

  IF v_herb.related_slugs IS NOT NULL AND cardinality(v_herb.related_slugs) > 0 THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('name', r.name, 'slug', r.slug, 'scientific_name', r.scientific_name)
        ORDER BY array_position(v_herb.related_slugs, r.slug)
      ),
      '[]'::jsonb
    )
    INTO v_related
    FROM public.herbs r
    WHERE r.is_published AND r.slug = ANY(v_herb.related_slugs);
  END IF;

  IF v_related IS NULL OR jsonb_array_length(v_related) = 0 THEN
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('name', elem->>'name', 'slug', elem->>'slug', 'scientific_name', elem->>'scientific_name')),
      '[]'::jsonb
    )
    INTO v_related
    FROM (
      SELECT elem FROM jsonb_array_elements(v_symptom_peers) AS elem LIMIT 3
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'herb', to_jsonb(v_herb) || jsonb_build_object(
      'herb_categories', v_category,
      'drug_interactions', v_interactions
    ),
    'regulatory', (
      SELECT to_jsonb(r)
      FROM public.herb_regulatory_evidence r
      WHERE r.herb_slug = p_slug
      LIMIT 1
    ),
    'monograph', (
      SELECT to_jsonb(m)
      FROM public.herb_monographs m
      WHERE m.herb_slug = p_slug AND m.status = 'published'
      LIMIT 1
    ),
    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'source', s.source,
        'licence', s.licence,
        'attribution', s.attribution,
        'url', s.url,
        'claims', s.claims,
        'safety', s.safety,
        'doses', s.doses,
        'monograph_date', s.monograph_date
      ) ORDER BY s.source)
      FROM public.herb_monograph_sources s
      WHERE s.herb_slug = p_slug
    ), '[]'::jsonb),
    'pubmed', (
      SELECT to_jsonb(p)
      FROM public.herb_pubmed_monographs p
      WHERE p.slug = p_slug
      LIMIT 1
    ),
    'faqs', coalesce((
      SELECT jsonb_agg(to_jsonb(f) ORDER BY f.sort_order)
      FROM (
        SELECT question, answer, category, translations, sort_order
        FROM public.herb_faqs
        WHERE herb_id = v_herb.id
        ORDER BY sort_order
        LIMIT 6
      ) f
    ), '[]'::jsonb),
    'related', coalesce(v_related, '[]'::jsonb),
    'neighbours', jsonb_build_object('prev', v_prev, 'next', v_next),
    'symptom_peers', v_symptom_peers
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.build_herb_page_bundle(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_herb_page_bundle(text) TO service_role;

-- 5. Serve precomputed bundles and lazily enrich any pre-00070 row on first read.
CREATE OR REPLACE FUNCTION public.herb_page_bundle(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_payload jsonb;
  v_id uuid;
  v_name text;
  v_cat_id uuid;
  v_keywords text[];
  v_category jsonb;
  v_interactions jsonb;
  v_prev jsonb;
  v_next jsonb;
  v_symptom_peers jsonb;
  v_related jsonb;
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
    RETURN v_payload;
  END IF;

  -- Lazy upgrade for rows built by migration 00067 before neighbours/embeds existed:
  -- computes only the missing delta via scalar index lookups and persists once.
  IF NOT (v_payload ? 'neighbours') THEN
    v_id := NULLIF(v_payload->'herb'->>'id', '')::uuid;
    v_name := v_payload->'herb'->>'name';
    v_cat_id := NULLIF(v_payload->'herb'->>'category_id', '')::uuid;

    IF v_cat_id IS NOT NULL THEN
      SELECT to_jsonb(c) INTO v_category
      FROM public.herb_categories c
      WHERE c.id = v_cat_id
      LIMIT 1;
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(di)), '[]'::jsonb)
    INTO v_interactions
    FROM public.drug_interactions di
    WHERE di.herb_id = v_id;

    SELECT jsonb_build_object('slug', p.slug, 'name', p.name, 'scientific_name', p.scientific_name)
    INTO v_prev
    FROM public.herbs p
    WHERE p.is_published AND p.name < v_name AND p.slug <> p_slug
    ORDER BY p.name DESC
    LIMIT 1;

    SELECT jsonb_build_object('slug', n.slug, 'name', n.name, 'scientific_name', n.scientific_name)
    INTO v_next
    FROM public.herbs n
    WHERE n.is_published AND n.name > v_name AND n.slug <> p_slug
    ORDER BY n.name ASC
    LIMIT 1;

    SELECT ARRAY(
      SELECT jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_payload->'herb'->'symptom_keywords') = 'array'
            THEN v_payload->'herb'->'symptom_keywords'
          ELSE '[]'::jsonb
        END
      )
    ) INTO v_keywords;

    IF v_keywords IS NOT NULL AND cardinality(v_keywords) > 0 THEN
      SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      INTO v_symptom_peers
      FROM (
        SELECT h2.slug, h2.name, h2.scientific_name
        FROM public.herbs h2
        WHERE h2.is_published
          AND h2.slug <> p_slug
          AND h2.symptom_keywords @> v_keywords[1:least(2, cardinality(v_keywords))]
        LIMIT 6
      ) p;
    ELSE
      v_symptom_peers := '[]'::jsonb;
    END IF;

    v_related := coalesce(v_payload->'related', '[]'::jsonb);
    IF jsonb_typeof(v_related) <> 'array' OR jsonb_array_length(v_related) = 0 THEN
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('name', elem->>'name', 'slug', elem->>'slug', 'scientific_name', elem->>'scientific_name')),
        '[]'::jsonb
      )
      INTO v_related
      FROM (
        SELECT elem FROM jsonb_array_elements(v_symptom_peers) AS elem LIMIT 3
      ) sub;
    END IF;

    v_payload := jsonb_set(
      v_payload,
      '{herb}',
      (v_payload->'herb') || jsonb_build_object(
        'herb_categories', v_category,
        'drug_interactions', v_interactions
      )
    ) || jsonb_build_object(
      'related', v_related,
      'neighbours', jsonb_build_object('prev', v_prev, 'next', v_next),
      'symptom_peers', v_symptom_peers
    );

    UPDATE public.herb_page_bundles
    SET payload = v_payload,
        built_at = now()
    WHERE slug = p_slug;
  END IF;

  RETURN v_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.herb_page_bundle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.herb_page_bundle(text) TO anon, authenticated, service_role;
