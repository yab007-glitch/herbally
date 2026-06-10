-- Adds a provenance jsonb column to herbs and herb_monographs so we can
-- distinguish (a) entries reviewed by a human against a primary source,
-- (b) entries auto-summarized by the AI pipeline, and (c) entries with no
-- verification yet ("unverified" — the soft default for the existing 2,700+ rows).
--
-- The shape is:
--   {
--     "verification_method": "manual" | "ai_summarized" | "primary_source" | "unverified",
--     "sources": string[],
--     "primary_url": string | null,
--     "last_verified_at": ISO timestamp | null,
--     "verified_by": string | null,
--     "notes": string
--   }
--
-- The CHECK constraint uses `provenance ? 'verification_method' = false OR ...`
-- so that the default empty object '{}' (which is what every existing row gets)
-- passes the constraint without ceremony.

ALTER TABLE public.herbs
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.herb_monographs
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'herbs_provenance_method_check'
  ) THEN
    ALTER TABLE public.herbs
      ADD CONSTRAINT herbs_provenance_method_check CHECK (
        provenance ? 'verification_method' = false
        OR provenance->>'verification_method' IN ('manual','ai_summarized','primary_source','unverified')
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monographs_provenance_method_check'
  ) THEN
    ALTER TABLE public.herb_monographs
      ADD CONSTRAINT monographs_provenance_method_check CHECK (
        provenance ? 'verification_method' = false
        OR provenance->>'verification_method' IN ('manual','ai_summarized','primary_source','unverified')
      );
  END IF;
END$$;

-- GIN index for `WHERE provenance @> '{"verification_method":"manual"}'`.
CREATE INDEX IF NOT EXISTS idx_herbs_provenance_method
  ON public.herbs USING GIN (provenance jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_monographs_provenance_method
  ON public.herb_monographs USING GIN (provenance jsonb_path_ops);

-- Backfill: monograph rows whose generation_method is 'ai' are explicitly
-- AI-summarized. The remaining rows stay at the soft default ('{}') which
-- is interpreted as 'unverified'.
UPDATE public.herb_monographs
  SET provenance = jsonb_set(
    COALESCE(provenance, '{}'::jsonb),
    '{verification_method}',
    '"ai_summarized"',
    true
  )
  WHERE generation_method = 'ai'
    AND (provenance IS NULL OR provenance->>'verification_method' IS NULL);
