-- 00086_safety_and_security_hardening.sql
-- Phase 1 remediation:
--   1. Correct dangerous/misleading dosage & pregnancy/nursing metadata on toxic
--      herbs (Aristolochia, Aconitum, Pennyroyal, Ephedra, Comfrey) and fix
--      corrupted dosage phrasing (including agropyron-repens / comfrey).
--   2. Revoke dangerous TRUNCATE/TRIGGER/REFERENCES grants from anon/authenticated
--      and revoke direct anon INSERT/UPDATE/DELETE across all public tables.
--   3. Harden RLS policies on web_vitals, dosage_calculations, herb_ratings,
--      and deduplicate overlapping chat_sessions policies.
--   4. Pin search_path = public, pg_temp on SECURITY DEFINER / helper functions
--      and optimize refresh_herb_page_bundles + partial index to cut seq scans.

BEGIN;

-- ── 1. Critical toxic-herb safety & dosage corrections ─────────────────────

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  dosage_adult = 'No safe dose — contraindicated in all forms (contains nephrotoxic and carcinogenic aristolochic acids; banned by Health Canada, FDA, and EMA).',
  contraindications = ARRAY[
    'All internal and external use (nephrotoxic and carcinogenic aristolochic acids)',
    'Kidney disease',
    'Pregnancy and nursing',
    'Children'
  ],
  translations = jsonb_set(
    COALESCE(translations, '{}'::jsonb),
    '{fr}',
    COALESCE(translations->'fr', '{}'::jsonb) || jsonb_build_object(
      'dosage_adult',
      'Aucune dose sûre — contre-indiquée sous toutes ses formes (contient des acides aristolochiques néphrotoxiques et cancérogènes ; interdite par Santé Canada, la FDA et l''EMA).'
    ),
    true
  ),
  updated_at = now()
WHERE slug = 'aristolochia-mollissima';

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  dosage_adult = 'Not recommended for self-medication — Aconitum species carry alkaloid toxicity and lethal adulteration risks; no established safe dose in pregnancy, nursing, or unsupervised use.',
  contraindications = ARRAY[
    'Self-medication without specialist supervision',
    'Pregnancy and nursing',
    'Children',
    'Cardiac arrhythmias or heart disease',
    'Risk of misidentification with lethal Aconitum species'
  ],
  translations = jsonb_set(
    COALESCE(translations, '{}'::jsonb),
    '{fr}',
    COALESCE(translations->'fr', '{}'::jsonb) || jsonb_build_object(
      'dosage_adult',
      'Déconseillée en automédication — les espèces du genre Aconitum présentent une toxicité alcaloïdique et un risque d''adultération mortelle ; aucune dose sûre établie pendant la grossesse, l''allaitement ou sans suivi médical spécialisé.'
    ),
    true
  ),
  updated_at = now()
WHERE slug = 'atis-tibetan';

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  dosage_adult = 'Internal use is not recommended — contains hepatotoxic and abortifacient pulegone; pennyroyal essential oil has caused fatal liver and kidney failure.',
  contraindications = ARRAY[
    'Pregnancy (abortifacient)',
    'Breastfeeding / nursing',
    'Liver or kidney disease',
    'Children',
    'All internal essential oil or concentrated extract use'
  ],
  translations = jsonb_set(
    COALESCE(translations, '{}'::jsonb),
    '{fr}',
    COALESCE(translations->'fr', '{}'::jsonb) || jsonb_build_object(
      'dosage_adult',
      'Usage interne déconseillé — contient de la pulégone hépatotoxique et abortive ; l''huile essentielle de menthe pouliot a causé des insuffisances hépatiques et rénales mortelles.'
    ),
    true
  ),
  updated_at = now()
WHERE slug IN ('lamiaceae-pennyroyal', 'pennyroyal-american');

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  dosage_adult = 'Do not self-medicate — banned in dietary supplements in the United States (FDA) and strictly restricted in Canada and the EU due to cardiovascular and CNS toxicity (severe hypertension, arrhythmias, stroke, myocardial infarction).',
  contraindications = ARRAY[
    'Cardiovascular disease or arrhythmias',
    'Hypertension',
    'Hyperthyroidism',
    'Pregnancy and nursing',
    'Anxiety, insomnia, or glaucoma',
    'Concomitant MAOIs, stimulants, or decongestants'
  ],
  translations = jsonb_set(
    COALESCE(translations, '{}'::jsonb),
    '{fr}',
    COALESCE(translations->'fr', '{}'::jsonb) || jsonb_build_object(
      'dosage_adult',
      'Ne pas utiliser en automédication — interdite dans les compléments alimentaires aux États-Unis (FDA) et strictement réglementée au Canada et dans l''UE en raison de risques cardiovasculaires et neurologiques graves (hypertension, arythmie, AVC, infarctus).'
    ),
    true
  ),
  updated_at = now()
WHERE slug IN (
  'ephedra-distachya',
  'ephedra-intermedia',
  'tibetan-ephedra',
  'ephedra-sinica',
  'ephedra-equisetina'
);

UPDATE public.herbs
SET
  pregnancy_safe = false,
  nursing_safe = false,
  dosage_adult = 'External use only on intact skin: apply a thin layer of PA-free ointment or liquid extract up to twice daily for short-term use. Never take internally (hepatotoxic pyrrolizidine alkaloids). Not recommended under 18 years, in pregnancy, or while nursing.',
  updated_at = now()
WHERE slug = 'comfrey';

UPDATE public.herbs
SET
  dosage_adult = 'Herbal tea: 3–6 g of dried rhizome in 250 ml boiling water as an herbal infusion several times daily (total daily dose 10–20 g). Liquid extract: 4–8 ml, 2 to 4 times daily. Tincture: 5–15 ml, 3 times daily. Not recommended under 18 years.',
  updated_at = now()
WHERE slug = 'agropyron-repens';

-- Defensive sweep for any remaining "times/once/twice a daily" typo anywhere in published herbs
UPDATE public.herbs
SET
  dosage_adult = regexp_replace(dosage_adult, '\y(times?|once|twice)\s+a\s+daily\y', '\1 daily', 'gi'),
  updated_at = now()
WHERE dosage_adult ~* '\y(times?|once|twice)\s+a\s+daily\y';

-- ── 2. Postgres privilege lockdown ─────────────────────────────────────────

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- Non-user-owned catalog, billing, and telemetry tables: authenticated users
-- only read public reference tables (or nothing where RLS has no policy).
-- Note: `herbs` retains authenticated INSERT/UPDATE/DELETE because src/lib/actions/admin-herbs.ts
-- runs through the RLS-scoped authenticated client with `is_admin()` enforcement.
REVOKE INSERT, UPDATE, DELETE ON
  public.donations,
  public.drug_interactions,
  public.herb_categories,
  public.herb_faqs,
  public.herb_monograph_sources,
  public.herb_monographs,
  public.herb_pubmed_monographs,
  public.herb_regulatory_evidence,
  public.newsletter_subscribers,
  public.web_vitals,
  public.webhook_events
FROM authenticated;

-- ── 3. RLS policy hardening & consolidation ────────────────────────────────

-- web_vitals now inserts via service_role in /api/analytics/vitals
DROP POLICY IF EXISTS "Allow anonymous inserts on web_vitals" ON public.web_vitals;

-- dosage_calculations: require authenticated ownership (drop OR user_id IS NULL)
DROP POLICY IF EXISTS "Users can insert own calculations" ON public.dosage_calculations;
CREATE POLICY "Users can insert own calculations"
  ON public.dosage_calculations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- herb_ratings: require authenticated ownership (drop unauthenticated guest_id loophole)
DROP POLICY IF EXISTS "Users manage own ratings" ON public.herb_ratings;
CREATE POLICY "Users manage own ratings"
  ON public.herb_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- chat_sessions: consolidate duplicate RLS policies (keep 1 admin SELECT + 4 user policies)
DROP POLICY IF EXISTS "Users can view own chats" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chats" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chats" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chats" ON public.chat_sessions;

-- ── 4. SECURITY DEFINER search_path hardening & seq-scan index/cron fix ───

ALTER FUNCTION public.build_herb_page_bundle(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.herb_page_bundle(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_herb_view_by_slug(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_herb_bundle_dirty() SET search_path = public, pg_temp;

CREATE INDEX IF NOT EXISTS idx_herbs_published_slug
  ON public.herbs (slug)
  WHERE is_published = true;

CREATE OR REPLACE FUNCTION public.refresh_herb_page_bundles(p_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    (
      SELECT d.slug
      FROM public.herb_bundle_dirty d
      ORDER BY d.slug
      LIMIT coalesce(p_limit, 500)
    )
    UNION
    (
      SELECT h.slug
      FROM public.herbs h
      LEFT JOIN public.herb_page_bundles b ON b.slug = h.slug
      WHERE h.is_published
        AND b.slug IS NULL
      ORDER BY h.slug
      LIMIT coalesce(p_limit, 500)
    )
    ORDER BY slug
    LIMIT coalesce(p_limit, 500)
  LOOP
    PERFORM public.herb_page_bundle(r.slug);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;

COMMIT;
