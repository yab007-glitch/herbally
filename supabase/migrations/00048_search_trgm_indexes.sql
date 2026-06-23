-- 00048_search_trgm_indexes.sql
-- M-10 (audit 2026-06-22): search_herbs_by_symptom (00017) runs
-- leading-wildcard ILIKE (`'%term%'`) across ~2,700 herbs. Only
-- name/scientific_name had pg_trgm GIN indexes (00011). Add a trigram GIN
-- index on `description` (a `text` column) so its ILIKE uses the index
-- instead of seq-scanning. Idempotent.
--
-- NOTE: the array columns (common_names, traditional_uses, modern_uses,
-- active_compounds) are `text[]` and are searched via
-- `EXISTS (SELECT 1 FROM unnest(col) el WHERE el ILIKE '%term%')`. Two
-- problems make a trigram index infeasible here without a query rewrite:
--   1. `gin_trgm_ops` only accepts `text`, NOT `text[]` (the original draft
--      of this migration failed mid-apply on exactly this).
--   2. The `unnest(...) ILIKE` query shape can't use ANY column index — the
--      array is unnested row-by-row before the ILIKE runs.
-- Accelerating the array ILIKEs would require rewriting the search function
-- to `array_to_string(col, ' ') ILIKE '%term%'` plus expression indexes
-- `gin(array_to_string(col,' ') gin_trgm_ops)`. That is a search-semantic
-- change (it would also match substrings spanning two array elements) and
-- is deferred as a follow-up rather than slipped into a deploy. For now
-- only the `description` ILIKE is index-accelerated; the array searches
-- remain seq scans, same as before this migration.

CREATE INDEX IF NOT EXISTS idx_herbs_description_trgm
  ON public.herbs USING gin(description gin_trgm_ops);