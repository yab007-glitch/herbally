-- 00048_search_trgm_indexes.sql
-- M-10 (audit 2026-06-22): search_herbs_by_symptom (00017) runs
-- leading-wildcard ILIKE (`'%term%'`) over description, common_names[],
-- traditional_uses[], modern_uses[], and active_compounds[] — all seq scans
-- across ~2,700 herbs. Only name/scientific_name had pg_trgm GIN indexes
-- (00011). Add trigram GIN indexes on the remaining searched columns so the
-- ILIKEs use the index instead of seq-scanning. pg_trgm's gin_trgm_ops
-- indexes each element of a text[] array. Idempotent.

CREATE INDEX IF NOT EXISTS idx_herbs_description_trgm
  ON public.herbs USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbs_common_names_trgm
  ON public.herbs USING gin(common_names gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbs_traditional_uses_trgm
  ON public.herbs USING gin(traditional_uses gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbs_modern_uses_trgm
  ON public.herbs USING gin(modern_uses gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbs_active_compounds_trgm
  ON public.herbs USING gin(active_compounds gin_trgm_ops);