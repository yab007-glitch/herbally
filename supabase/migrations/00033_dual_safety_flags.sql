-- ============================================================================
-- MIGRATION 00033: Dual-Safe Routing — Split safety flags by application vector
-- ============================================================================
-- Problem: Herbs like Aloe Vera are safe TOPICALLY but unsafe ORALLY during
-- pregnancy. The old boolean pregnancy_safe/nursing_safe flags couldn't
-- distinguish between application routes, causing safety conflicts.
--
-- Solution: Add *_oral and *_topical variants of each safety flag.
-- The old flags are preserved for backward compatibility — they represent
-- the DEFAULT route (oral for ingestible herbs, topical for external ones).
-- ============================================================================

-- Step 1: Add new columns
ALTER TABLE public.herbs
  ADD COLUMN IF NOT EXISTS pregnancy_safe_oral BOOLEAN,
  ADD COLUMN IF NOT EXISTS pregnancy_safe_topical BOOLEAN,
  ADD COLUMN IF NOT EXISTS nursing_safe_oral BOOLEAN,
  ADD COLUMN IF NOT EXISTS nursing_safe_topical BOOLEAN;

-- Step 2: Backfill — copy existing flags to both routes as default
-- For most herbs, oral and topical safety are the same.
-- Known exceptions are handled in Step 3.
UPDATE public.herbs
SET 
  pregnancy_safe_oral = pregnancy_safe,
  pregnancy_safe_topical = pregnancy_safe,
  nursing_safe_oral = nursing_safe,
  nursing_safe_topical = nursing_safe
WHERE pregnancy_safe_oral IS NULL;

-- Step 3: Fix known exceptions — herbs safe topically but not orally

-- Aloe Vera: safe topically, avoid internally during pregnancy
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'aloe-vera';

-- Arnica: safe topically, toxic internally
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'arnica';

-- Comfrey: safe topically, toxic internally (pyrrolizidine alkaloids)
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'comfrey';

-- Tea Tree: safe topically, toxic if ingested
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'tea-tree';

-- Witch Hazel: safe topically, limited oral safety data
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'witch-hazel';

-- Cayenne (capsaicin): safe topically for pain, avoid high oral doses
UPDATE public.herbs SET
  pregnancy_safe_topical = true,
  nursing_safe_topical = true
WHERE slug = 'cayenne';

-- Eucalyptus: safe as inhalant/topical, toxic if ingested
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = true,
  nursing_safe_oral = false,
  nursing_safe_topical = true
WHERE slug = 'eucalyptus';

-- Shea Butter / Jojoba / Rosehip — purely topical herbs
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  pregnancy_safe_topical = pregnancy_safe,
  nursing_safe_oral = false,
  nursing_safe_topical = nursing_safe
WHERE slug IN ('shea-butter', 'jojoba', 'rosehip', 'centella');

-- Butterbur: only PA-free extracts are safe; default to caution
UPDATE public.herbs SET
  pregnancy_safe_oral = false,
  nursing_safe_oral = false
WHERE slug = 'butterbur';

-- Step 4: Add constraint comments
COMMENT ON COLUMN public.herbs.pregnancy_safe_oral IS 'Safety during pregnancy when taken orally (ingested)';
COMMENT ON COLUMN public.herbs.pregnancy_safe_topical IS 'Safety during pregnancy when applied topically (skin)';
COMMENT ON COLUMN public.herbs.nursing_safe_oral IS 'Safety during nursing when taken orally';
COMMENT ON COLUMN public.herbs.nursing_safe_topical IS 'Safety during nursing when applied topically';

-- The original pregnancy_safe and nursing_safe columns remain as the DEFAULT/aggregate.
-- For display purposes, if both oral and topical are set, use the more restrictive value.
