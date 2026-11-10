-- Retroactive baseline for two tables that were created out-of-band.
--
-- `herb_monograph_sources` and `herb_regulatory_evidence` exist in production
-- (the regulator imports created them through the SQL editor), but no migration
-- in this repo ever created them. A database rebuilt from these files therefore
-- fails at 00067, whose triggers reference both tables. This file restores the
-- missing baseline in the correct position: after 00066, before 00067.
--
-- Columns, defaults and constraints mirror production as inspected on
-- 2026-11-08. `IF NOT EXISTS` makes it a no-op on the existing database.

CREATE TABLE IF NOT EXISTS public.herb_monograph_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  herb_slug         text NOT NULL,
  source            text NOT NULL,
  licence           text,
  attribution       text,
  url               text,
  claims            jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety            jsonb NOT NULL DEFAULT '[]'::jsonb,
  doses             jsonb NOT NULL DEFAULT '[]'::jsonb,
  generation_method text NOT NULL,
  monograph_date    date,
  retrieved_at      date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (herb_slug, source)
);

CREATE INDEX IF NOT EXISTS herb_monograph_sources_slug_idx
  ON public.herb_monograph_sources (herb_slug);

ALTER TABLE public.herb_monograph_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view excerpts for published herbs"
  ON public.herb_monograph_sources;
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

CREATE TABLE IF NOT EXISTS public.herb_regulatory_evidence (
  herb_slug        text PRIMARY KEY,
  source           text NOT NULL,
  source_licence   text NOT NULL,
  purposes         jsonb NOT NULL DEFAULT '[]'::jsonb,
  doses            jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks            jsonb NOT NULL DEFAULT '[]'::jsonb,
  products_sampled integer NOT NULL DEFAULT 0,
  source_urls      jsonb NOT NULL DEFAULT '[]'::jsonb,
  retrieved_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS herb_regulatory_evidence_slug_idx
  ON public.herb_regulatory_evidence (herb_slug);

ALTER TABLE public.herb_regulatory_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS herb_regulatory_evidence_public_read
  ON public.herb_regulatory_evidence;
CREATE POLICY herb_regulatory_evidence_public_read
  ON public.herb_regulatory_evidence
  FOR SELECT
  USING (true);

REVOKE ALL ON TABLE public.herb_regulatory_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.herb_regulatory_evidence TO anon, authenticated;
GRANT ALL ON TABLE public.herb_regulatory_evidence TO service_role;
