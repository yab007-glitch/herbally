-- Migration 00095: Strip remaining stale fabricated '2026-06-23' last_verified_at keys
-- on non-human-reviewed herbs (rows downgraded from human_reviewed to needs_re_review
-- by Migration 00092 before line 820 was patched) and queue affected bundles for refresh.
--
-- NON-NEGOTIABLE: Never sets provenance.review_status = 'human_reviewed'.

BEGIN;

WITH upd AS (
  UPDATE public.herbs
  SET
    provenance = provenance - 'last_verified_at',
    updated_at = now()
  WHERE provenance->>'last_verified_at' LIKE '2026-06-23%'
    AND COALESCE(provenance->>'review_status', '') <> 'human_reviewed'
  RETURNING slug
)
INSERT INTO public.herb_bundle_dirty (slug, queued_at)
SELECT slug, now()
FROM upd
ON CONFLICT (slug) DO UPDATE SET queued_at = excluded.queued_at;

COMMIT;

-- After applying on herbally-db, refresh precomputed bundles until 0 remain:
--   DO $$ DECLARE n int; BEGIN LOOP n := public.refresh_herb_page_bundles(500); EXIT WHEN n = 0; END LOOP; END $$;
