-- Close a public write path on the source-excerpt table.
--
-- `herb_monograph_sources` shipped without RLS while anon and authenticated held
-- the full Supabase default grant (SELECT, INSERT, UPDATE, DELETE, TRUNCATE).
-- The anon key is public (it ships to the browser), and PostgREST exposes every
-- granted verb on a table with RLS disabled — so anyone could rewrite or delete
-- the regulator excerpts that feed the herb pages and the precomputed bundles.
-- The Supabase security advisor flags this as `rls_disabled_in_public` (ERROR).
--
-- Reads must keep working: the herb page queries this table with the anon client.
-- The SELECT policy is limited to excerpts of published herbs, matching the
-- existing `Anyone can view published herbs` policy on public.herbs.
--
-- `herb_regulatory_evidence` already has RLS and a public SELECT policy, but the
-- anon/authenticated grants still include write verbs. RLS blocks INSERT/UPDATE/
-- DELETE there (no write policy exists), yet TRUNCATE is governed by privileges,
-- not RLS — so trim the grants as well.

ALTER TABLE public.herb_monograph_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view excerpts for published herbs" ON public.herb_monograph_sources;
CREATE POLICY "Anyone can view excerpts for published herbs"
  ON public.herb_monograph_sources
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.herbs h
      WHERE h.slug = public.herb_monograph_sources.herb_slug
        AND h.is_published
    )
  );

REVOKE ALL ON TABLE public.herb_monograph_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.herb_monograph_sources TO anon, authenticated;
GRANT ALL ON TABLE public.herb_monograph_sources TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.herb_regulatory_evidence FROM anon, authenticated;
GRANT SELECT ON TABLE public.herb_regulatory_evidence TO anon, authenticated;
GRANT ALL ON TABLE public.herb_regulatory_evidence TO service_role;
